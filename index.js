const async = require('async');
const fs = require('fs');
const NodeRSA = require('node-rsa');
const path = require('path');
const request = require('request');
const x509 = require('x509');
const httpStatus = require('http-status');
const winston = require('winston');
const formatCertificate = require('./lib/formatcertificate');
const jwtVerify = require('./lib/verifyjwt');
const redisClient = require('./lib/redisclient');

const calljwtVerify = (req, res, next, extPublicKey) => {
  return jwtVerify(req, extPublicKey, (err, decoded) => {
    if (err) {
      return res.status(httpStatus.UNAUTHORIZED).send(err);
    }
    req.userInfo = JSON.stringify(decoded);
    return next();
  });
};

const createCert = (x5c) => {
  const x5cFormatted = formatCertificate(x5c);
  const certFilename = path.join(__dirname, 'tmp.crt');
  fs.writeFileSync(certFilename, x5cFormatted, { encoding: 'UTF-8' });
  const parsedKey = x509.parseCert(certFilename);
  fs.unlinkSync(certFilename);

  const key = new NodeRSA();
  key.importKey({
    n: new Buffer(parsedKey.publicKey.n, 'hex'),
    e: parseInt(parsedKey.publicKey.e, 10)
  }, 'components-public');
  return key.exportKey('public');
};

const verify = function () {
  const idamDiscUrl = process.env.idamDiscUrl || 'https://fedsvc-dev.pwc.com/ofisidd/api/discovery';
  const redisKey = 'getSigningCerts';
  return (req, res, next) => {
    winston.log('info', 'IdamTokenValidator: verify()');
    if (!req.header('Authorization')) {
      return res.status(httpStatus.UNAUTHORIZED).send({ name: 'JsonWebTokenError', message: 'Missing token in request header' });
    }

    try {
      redisClient.get(redisKey, (error, cacheResult) => {
        winston.log('info', 'IdamTokenValidator: Inside Redis Check');
        if (cacheResult) {
          // The result is in the cache, return it
          winston.log('info', 'IdamTokenValidator: Found cache for key --', { redisKey });
          const cachedPublicKey = createCert(JSON.parse(cacheResult).keys[0].x5c);
          calljwtVerify(req, res, next, cachedPublicKey);
        } else {
          winston.log('info', 'IdamTokenValidator: Not Found in cache --', { redisKey });
          async.waterfall(
            [
              (callback) => {
                request.get(idamDiscUrl, (err, discoveryResponse) => {
                  if (err) {
                    return callback(err);
                  }
                  winston.log('info', 'IdamTokenValidator: jwks_uri --', JSON.parse(discoveryResponse.body).jwks_uri);
                  return callback(null, JSON.parse(discoveryResponse.body).jwks_uri);
                });
              },
              (jwksUri, callback) => {
                request.get(jwksUri, (err, jwksResponse) => {
                  if (err) {
                    return callback(err);
                  }
                  redisClient.setex(redisKey,
                    parseInt((new Date().setHours(23, 59, 59, 999) - new Date()) / 1000, 10),
                    jwksResponse.body, (redisError) => {
                      if (redisError) {
                        winston.log('error', 'IdamTokenValidator: Redis Error --', {
                          redisError
                        });
                        callback(redisError);
                      }
                    });
                  winston.log('info', 'IdamTokenValidator: jwksResponse_x5c --', JSON.parse(jwksResponse.body).keys[0].x5c);
                  return callback(null, JSON.parse(jwksResponse.body).keys[0].x5c);
                });
              },
              (x5c, callback) => {
                return callback(createCert(x5c));
              }
            ],
            (err, result) => {
              if (err) {
                return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(err);
              }
              calljwtVerify(req, res, next, result);
              return null;
            });
        }
      });
    } catch (err) {
      winston.log('error', 'IdamTokenValidator: System error -- ', err);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(err);
    }
    return null;
  };
};

module.exports.verify = verify;

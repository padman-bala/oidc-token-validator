const jwt = require('jsonwebtoken');

const verifyJwt = function (req, publicKey, callback) {
  const header = req.header('Authorization');
  const token = header.replace(/Bearer /, '');

  jwt.verify(token, publicKey, { format: 'PKCS8', algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      return callback(err, decoded);
    }
    return callback(err, decoded);
  });
};

module.exports = verifyJwt;

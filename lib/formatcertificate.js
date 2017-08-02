const formatCertificate = function (cert) {
  const beginCert = '-----BEGIN CERTIFICATE-----';
  const endCert = '-----END CERTIFICATE-----';

  let certContent = cert.replace('\n', '');
  certContent = certContent.replace(beginCert, '');
  certContent = certContent.replace(endCert, '');

  let result = beginCert;
  result += '\n';
  result += certContent;
  result += '\n';
  result += endCert;
  return result;
};

module.exports = formatCertificate;

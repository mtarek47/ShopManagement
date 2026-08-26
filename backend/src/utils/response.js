// Ensure BigInt values are safely serialized into Numbers in JSON
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return Number(this);
  };
}

const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({ success: true, message, data });
};

const sendError = (res, message = 'Error', statusCode = 400, errors = null) => {
  res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
};

module.exports = { sendSuccess, sendError };

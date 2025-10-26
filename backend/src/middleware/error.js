function errorHandler(err, req, res, next) {
  req.log && req.log.error({ err }, "Unhandled error");

  if (err && err.name === "ValidationError") {
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors,
    });
  }

  if (err && err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : "field";
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  if (err && err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
}

function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
}

module.exports = { errorHandler, notFound };

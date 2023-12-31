const crypto = require("crypto");
const ethers = require("ethers");

const Quote = require("../models/quote.model.js");
const Nonce = require("../models/nonce.model.js");
const { errorResponse } = require("./error.js");

const quoteidRegex = /^[a-fA-F0-9]{32}$/;

exports.create = async (req, res) => {
  console.log(`getQuote request: ${JSON.stringify(req.body)}`);

  // Validate request
  if (!req.body) {
    errorResponse(req, res, null, 400, "Content can not be empty!");
    return;
  }

  // validate fields
  let type = req.body.type;
  if (typeof type === "undefined") {
    errorResponse(req, res, null, 400, "Missing type.");
    return;
  }
  if (typeof type !== "string") {
    errorResponse(req, res, null, 400, "Invalid type.");
    return;
  }
  if (type != "ipfs") {
    errorResponse(req, res, null, 400, "Invalid type.");
    return;
  }

  let userAddress = req.body.userAddress;
  if (typeof userAddress === "undefined") {
    errorResponse(req, res, null, 400, "Missing userAddress.");
    return;
  }
  if (typeof userAddress !== "string") {
    errorResponse(req, res, null, 400, "Invalid userAddress.");
    return;
  }
  if (!ethers.utils.isAddress(userAddress)) {
    errorResponse(req, res, null, 400, "Invalid userAddress.");
    return;
  }

  let files = req.body.files;
  if (typeof files === "undefined") {
    errorResponse(req, res, null, 400, "Missing files field.");
    return;
  }
  if (typeof files !== "object" || !Array.isArray(files)) {
    errorResponse(req, res, null, 400, "Invalid files field.");
    return;
  }
  if (files.length == 0) {
    errorResponse(req, res, null, 400, "Empty files field.");
    return;
  }

  if (files.length > 64) {
    errorResponse(req, res, null, 400, "Too many files. Max 64.");
    return;
  }

  let totalLength = 0;
  let file_lengths = [];
  for (let i = 0; i < files.length; i++) {
    if (typeof files[i] !== "object") {
      errorResponse(req, res, null, 400, "Invalid files field.");
      return;
    }
    if (!files[i].hasOwnProperty("length")) {
      errorResponse(req, res, null, 400, "Invalid files field.");
      return;
    } else {
      file_length = files[i].length;
      if (
        isNaN(file_length) ||
        (typeof file_length !== "number" && typeof file_length !== "string") ||
        (typeof file_length === "string" && file_length.trim() === "")
      ) {
        errorResponse(req, res, null, 400, "Invalid files length.");
        return;
      }
      file_length = parseInt(file_length);

      if (file_length <= 0) {
        errorResponse(req, res, null, 400, "Files length too small.");
        return;
      }
      if (
        process.env.MAX_UPLOAD_SIZE > 0 &&
        file_length > process.env.MAX_UPLOAD_SIZE
      ) {
        errorResponse(
          req,
          res,
          null,
          400,
          `Individual files may not exceed ${process.env.MAX_UPLOAD_SIZE} bytes`
        );
        return;
      }
    }
    totalLength = totalLength + file_length;
    file_lengths.push(file_length);
  }

  if (
    process.env.MAX_UPLOAD_SIZE > 0 &&
    totalLength > process.env.MAX_UPLOAD_SIZE
  ) {
    errorResponse(
      req,
      res,
      null,
      400,
      `Total file length may not exceed ${process.env.MAX_UPLOAD_SIZE} bytes`
    );
    return;
  }

  const quoteId = crypto.randomBytes(16).toString("hex");
  console.log("quoteId", quoteId);

  const quote = new Quote({
    quoteId: quoteId,
    status: Quote.QUOTE_STATUS_WAITING,
    created: Date.now(),
    chainId: "0",
    tokenAddress: "0x0000000000000000000000000000000000000000",
    userAddress: userAddress,
    tokenAmount: "0",
    approveAddress: "0x0000000000000000000000000000000000000000",
    files: file_lengths,
  });
  console.log("quote", quote);

  try {
    const data = Quote.create(quote);
    console.log(`${req.path} response: 200: ${JSON.stringify(data)}`);
    res.send(data);
  } catch (err) {
    errorResponse(
      req,
      res,
      err,
      400,
      "Error occurred while creating the quote."
    );
  }
};

exports.getStatus = async (req, res) => {
  console.log(`getStatus request: ${JSON.stringify(req.query)}`);

  if (!req.query || !req.query.quoteId) {
    errorResponse(req, res, null, 400, "Error, quoteId required.");
    return;
  }
  const quoteId = req.query.quoteId;

  if (!quoteidRegex.test(quoteId)) {
    errorResponse(req, res, null, 400, "Invalid quoteId format.");
    return;
  }

  try {
    const status = Quote.getStatus(quoteId);
    if (status == undefined) {
      errorResponse(req, res, null, 404, "Quote not found.");
      return;
    }
    console.log(`${req.path} response: 200: ${JSON.stringify(status)}`);
    res.send(status);
  } catch (err) {
    errorResponse(
      req,
      res,
      err,
      500,
      "Error occurred while looking up status."
    );
  }
};

exports.setStatus = async (quoteId, status) => {
  try {
    Quote.setStatus(quoteId, status);
  } catch (err) {
    console.error(err);
  }
};

exports.getLink = async (req, res) => {
  console.log(`getLink request: ${JSON.stringify(req.query)}`);

  if (!req.query || !req.query.quoteId) {
    errorResponse(req, res, null, 400, "Error, quoteId required.");
    return;
  }
  const quoteId = req.query.quoteId;

  if (!quoteidRegex.test(quoteId)) {
    errorResponse(req, res, null, 400, "Invalid quoteId format.");
    return;
  }

  const nonce = req.query.nonce;
  if (typeof nonce === "undefined") {
    errorResponse(req, res, null, 400, "Missing nonce.");
    return;
  }
  if (typeof nonce !== "string") {
    errorResponse(req, res, null, 400, "Invalid nonce.");
    return;
  }

  const signature = req.query.signature;
  if (typeof signature === "undefined") {
    errorResponse(req, res, null, 400, "Missing signature.");
    return;
  }
  if (typeof signature !== "string") {
    errorResponse(req, res, null, 400, "Invalid signature format.");
    return;
  }

  let quote;
  try {
    quote = Quote.get(quoteId);
  } catch (err) {
    errorResponse(
      req,
      res,
      err,
      500,
      "Error occurred while looking up userAddress."
    );
    return;
  }

  if (quote == undefined) {
    errorResponse(req, res, null, 404, "Quote not found.");
    return;
  }
  if (quote?.status != Quote.QUOTE_STATUS_UPLOAD_END) {
    errorResponse(req, res, null, 400, "Upload not completed yet.");
    return;
  }

  const userAddress = quote.userAddress;
  const message = ethers.utils.sha256(
    ethers.utils.toUtf8Bytes(quoteId + nonce.toString())
  );
  let signerAddress;
  try {
    signerAddress = ethers.utils.verifyMessage(message, signature);
  } catch (err) {
    errorResponse(req, res, err, 403, "Invalid signature.");
    return;
  }

  if (signerAddress != userAddress) {
    errorResponse(req, res, null, 403, "Invalid signature.");
    return;
  }

  let oldNonce;
  try {
    oldNonce = Nonce.get(userAddress)?.nonce || 0.0;
  } catch (err) {
    errorResponse(req, res, err, 500, "Error occurred while validating nonce.");
    return;
  }
  if (parseFloat(nonce) <= parseFloat(oldNonce)) {
    errorResponse(req, res, null, 403, "Invalid nonce.");
    return;
  }
  try {
    Nonce.set(userAddress, nonce);
  } catch (err) {
    errorResponse(req, res, err, 500, "Error occurred while setting nonce.");
    return;
  }

  let link;
  try {
    link = Quote.getLink(quoteId);
  } catch (err) {
    errorResponse(req, res, err, 500, "Error occurred while looking up link.");
    return;
  }

  if (link == undefined) {
    errorResponse(req, res, null, 404, "Link(s) not found.");
    return;
  }
  console.log(`${req.path} response: 200: ${JSON.stringify(link)}`);
  res.send(link);
};

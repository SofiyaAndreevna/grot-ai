const { buildChatReply } = require('../services/chatService');
const { ApiError } = require('../errors/ApiError');
const { chatBodySchema } = require('../validators/chatSchemas');

function postChat(req, res, next) {
  const parseResult = chatBodySchema.safeParse(req.body || {});
  if (!parseResult.success) {
    return next(new ApiError(400, 'Message is required', 'VALIDATION_ERROR', parseResult.error.issues));
  }

  const { message, topic } = parseResult.data;
  return res.json(buildChatReply({ message, topic }));
}

module.exports = {
  postChat,
};

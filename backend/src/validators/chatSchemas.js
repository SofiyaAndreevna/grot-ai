const { z } = require('zod');

const chatBodySchema = z.object({
  message: z.string().trim().min(1),
  topic: z.string().optional(),
});

module.exports = {
  chatBodySchema,
};

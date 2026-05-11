function buildChatReply({ message, topic }) {
  const trimmedMessage = message.trim();
  const safeTopic = typeof topic === 'string' && topic.trim() ? topic.trim() : 'Общий';

  return {
    reply: `Тема "${safeTopic}": получил вопрос "${trimmedMessage}". Это демо-ответ от backend на Express.`,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  buildChatReply,
};

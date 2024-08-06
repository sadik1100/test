// Echo any message sent to the bot
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.text && !msg.text.startsWith('/')) { // Avoid echoing command messages
        bot.sendMessage(chatId, `You said: ${msg.text}`);
    }
});

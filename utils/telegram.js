import NodeTelegramBot from 'node-telegram-bot-api'

const CHAT_ID = '-815617279'

class TelegramBot {
  constructor(token) {
    this.bot = new NodeTelegramBot(token, { polling: true })
    this.chatId = CHAT_ID
  }

  getFileLink(fileId) {
    return this.bot.getFileLink(fileId)
  }

  on(event, cb) {
    try {
      this.bot.on(event, cb)
    } catch (error) {
      console.log({ error })
    }
  }

  sendMessage(content, replyId, options) {
    const config = { ...options }
    if (replyId) config.reply_to_message_id = replyId
    return this.bot.sendMessage(this.chatId, content, config)
  }

  sendPhoto(photo, options) {
    return this.bot.sendPhoto(this.chatId, photo, options)
  }
}

export default TelegramBot

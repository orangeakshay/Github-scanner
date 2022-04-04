module.exports = class AppError extends Error {
    constructor(message, status) {
        super(message)
        this.stack = ''
        this.name = this.constructor.name
        this.status = status
    }
}

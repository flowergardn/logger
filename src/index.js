/** Class representing AstridLogger */
const chalk = require("chalk");
const Dayjs = require("dayjs");
const axios = require("axios").default;
const {AxiosResponse} = require("axios")

const {freemem, totalmem} = require('os');
const pB = require('pretty-bytes');

module.exports.Logger = class Logger {

    /**
     @typedef LoggerColors
     @type {Object}
     @property {string|undefined} error The error color
     @property {string|undefined} success The success color
     @property {string|undefined} debug The debug color
     @property {string|undefined} title The color of the title
     */

    /**
     @typedef TwilioConfiguration
     @type {Object}
     @property {string} [enabled=false] Send text messages with Twilio?
     @property {string} [accountSID=null] Your Twilio account SID
     @property {string} [authToken=null] Your Twilio authorization token
     @property {string} [sendTo=null] The number to send texts to
     @property {string} [sendFrom=null] The number to send texts from
     @property {string} [errorContent=null] The content to send when there is an error.
     */

    /**
     @typedef DiscordConfiguration
     @type {Object}
     @property {string} [enabled=false] Send Discord webhooks?
     @property {string} [errorWebhook=null] Discord webhook for error logs
     @property {string} [debugWebhook=null] Discord webhook for debug logs (Not recommended)
     @property {string} [successWebhook=null] Discord webhook for success logs

     @property {Object} [errorEmbed=null] Error embed object to send when there is an error
     @property {Object} [successEmbed=null] Success embed object to send when there is a success message
     @property {Object} [errorContent=null] Error content to send when there is an error message
     @property {Object} [successContent=null] Success content to send when there is a success message
     */

    /**
     * @export
     * @return {{success: boolean}} An instance of AstridLogger
     * @param {Object} opt  Configuration variables
     * @param {LoggerColors} [opt.colors = {}]  Color configuration
     * @param {TwilioConfiguration} [opt.twilio = {}]  Twilio configuration
     * @param {DiscordConfiguration} [opt.discord = {}]  Discord configuration
     */
    constructor(opt = { }) {
        if(!opt.colors) opt.colors = {error: "#F54242", success: "#8CE86D", debug: "#D6D6D6", title: "#8CE86D"};

        /**
         * Internal configuration for the logger
         * @private
         */

        this.config = opt;

        /**
         * Internal variable for the file the function was executed in
         * @private
         */

        this.file = require('caller')();

        // If twilio functionality is enabled
        if(opt.twilio && opt.twilio?.enabled) {
            if(opt.twilio?.accountSID && opt.twilio?.authToken) {
                /**
                 * Internal variable for the twilioClient
                 * @private
                 */
                this.twilioClient = require('twilio')(opt.twilio.accountSID, opt.twilio.authToken);
            } else
                this._genericLogger(1, `AstridLogger`, `Twilio integration enabled, but accountSID or authToken was not found.`);
        }
    }

    /**
     * @private
     * @param {number} type The logger type
     * @param {String} title The title of this log
     * @param {String} messages Messages to send within this log
     */

    _genericLogger(type, title, ...messages) {
        const {error: errorColor, success: successColor, debug: debugColor, title: titleColor} = this.config?.colors;
        let logType;
        switch (type) {
            case 1:
                logType = chalk.hex(errorColor ?? "#F54242")("ERROR");
                break;
            case 2:
                logType = chalk.hex(successColor ?? "#8CE86D")("SUCCESS");
                break;
            default:
                logType = chalk.hex(debugColor ?? "#D6D6D6")("DEBUG");
                break;
        }
        console.log(
            `[${Dayjs().format("MM/DD hh:m")}] ${logType} - ${chalk.hex(titleColor ?? "#8CE86D")(
                title
            )}: ${messages.join(" ")}`
        );
    }

    /**
     * @private
     */
    getFile() {
        let split;
        if(require("os").type() === "Windows_NT") split = this.file.split("\\");
        else split = this.file.split("/");
        return split.pop();
    }

    /**
     * Parses a string
     * @param {String|Array} str The string to parse
     * @param {String} [content=""] The content to replace with
     * @private
     */
    parseString(str, content = "") {
        let _str = str;
        if(Array.isArray(str)) {
            _str = str.join(" ");
        }

        if(!_str) return this._genericLogger(1, `AstridLogger - Parser`, `No string was passed into the parser.`);

        // File variables
        _str = _str.replace(/{{FILE}}/ig, this.getFile());
        _str = _str.replace(/{{PATH}}/ig, this.file);

        // Error content
        _str = _str.replace(/{{CONTENT}}/ig, content);

        // Formatted time
        _str = _str.replace(/{{TIME}}/ig, Dayjs().format("MM/DD hh:m"));

        // Unix time
        _str = _str.replace(/{{UNIX}}/ig, Dayjs().unix())

        // Memory used
        _str = _str.replace(/{{USED_MEMORY}}/ig, pB(totalmem() - freemem()))
        _str = _str.replace(/{{FREE_MEMORY}}/ig, pB(freemem()))
        _str = _str.replace(/{{TOTAL_MEMORY}}/ig, pB(totalmem()))

        return _str;
    }

    /**
     * Sends a webhook
     * @private
     * @type {AxiosResponse}
     * @param {String} webhook - The webhook URL
     * @param {Object} data - The data to send to the webhook
     * @param {String} [data.content=null]  The message content to send
     * @param {String} [data.username=""]  The username to name the webhook
     * @param {String} [data.avatar_url=""]  The pfp the webhook should have
     * @param {Array} [data.embeds=[]]  The embeds to send along with the message
     */
    async sendWebhook(webhook, data) {
        if(!webhook)
            this._genericLogger(1, `AstridLogger - Discord`, `No webhook specified!`);
        else return await axios.post(webhook, data)
    }

    /**
     * Internal function for sending logs
     * @private
     * @param {String} [type="error"]  The type of log
     * @param {Object} opt The options of this log
     * @param {String} [opt.title = "file name"]  The title of this log
     * @param {String|Array} opt.messages  The messages to send
     * @param {boolean} [opt.disableTwilio = false]  Disable twilio for this log? (Default: false)
     * @param {boolean} [opt.disableDiscord = false]  Disable Discord for this log? (Default: false)
     */

     async _sendLog(type, opt) {
        if(!this || !this.config) return console.log(`AstridLogger: Error loading config! Did you destructure a function??`)
        if(type !== "error" && type !== "success" && type !== "debug") return console.log(`AstridLogger: Error logging! Invalid log type, this should not of happened.`)

        const {discord = {enabled: false}, twilio = {enabled: false}} = this.config;

        let responseObj = {
            file: this.getFile()
        };

        // Get title from options, if there's no title, set the title to the file name.
        let title = opt.title ?? this.getFile();
        // Send the messages into the console beautifully
        let logType;
        switch(type) {
            case "error":
                logType = 1
                break;
            case "success":
                logType = 2
                break;
            case "debug": logType = 3
        }
        this._genericLogger(logType, title, ...opt.messages);

        if (discord.enabled && !opt.disableDiscord) {
            // do Discord stuff
            if (!discord[`${type}Webhook`]) {
                this._genericLogger(1, `AstridLogger - Discord`, `No ${type} webhook specified!`);
                responseObj.discord = {
                    sent: false
                };
            } else {
                // Initialize a Discord data variable
                let discordData = {};
                // If an error embed object is spc
                if (discord[`${type}Embed`]) discordData.embeds = [discord[`${type}Embed`]];

                else if (discord[`${type}Content`]) discordData.content = this.parseString(discord[`${type}Content`], opt.messages.join(" "));
                if (!discordData.content) discordData.content = `No content specified`

                try {
                    let webhook = await this.sendWebhook(discord[`${type}Webhook`], discordData);
                    responseObj.discord = {
                        sent: true,
                        data: webhook
                    }
                } catch (err) {
                    this._genericLogger(1, `AstridLogger - Discord`, `Error sending ${type} webhook!`, err);
                }
            }
        }

        if(twilio.enabled && !opt.disableTwilio) {
            const twilio = this.twilioClient;
            let twilioConfig = this.config.twilio;
            const {sendTo, sendFrom} = twilioConfig;

            if(!sendTo.includes("+") || !sendFrom.includes("+")) {
                this._genericLogger(1, `AstridLogger - Twilio`, `Error sending text! Numbers must be in ISO 3166 format; refer to the Twilio documentation for more information.`);
            }

            try {
                let twilioData = await twilio.messages
                    .create({
                        body: this.parseString(twilioConfig[`${type}Content`], opt.messages),
                        from: sendFrom,
                        to: sendTo
                    })
                responseObj.twilo = {
                    sent: true,
                    data: twilioData
                }
            } catch(err) {
                this._genericLogger(1, `AstridLogger - Twilio`, `Error sending text!\n`, err);
                responseObj.twilo = {
                    sent: false,
                    err
                }
            }
        }

        return responseObj;
    }

    /**
     * @typedef LoggerResponse
     * @type {Object}
     * @param {String} file - The file the error was from
     * @property {boolean} sent Whether or not everything was sent
     * @property {Object} [data={}] Optional data about the response
     */

    /**
     * @export
     * @return {LoggerResponse} A error response
     * @param {Object} opt The options of this log
     * @param {String} [opt.title = "file name"]  The title of this log
     * @param {String|Array} opt.messages  The messages to send
     * @param {boolean} [opt.disableTwilio = false]  Disable twilio for this log? (Default: false)
     * @param {boolean} [opt.disableDiscord = false]  Disable Discord for this log? (Default: false)
     */

    async error(opt = {title: null, messages: ["No message provided"]}) {
         try {
             await this._sendLog("error", opt)
         } catch(err) {
             console.log(`AstridLogger: Error sending error log lmao`, err);
         }
    }

    /**
     * @export
     * @return {LoggerResponse} A success response
     * @param {Object} opt The options of this log
     * @param {string} [opt.title = "file name"]  The title of this log
     * @param {string|Array} opt.messages  The messages to send
     * @param {boolean} [opt.disableTwilio = false]  Disable twilio for this log? (Default: false)
     * @param {boolean} [opt.disableDiscord = false]  Disable Discord for this log? (Default: false)
     */

    async success(opt = {title: "a", messages: ["No message provided"], disableTwilio: false, disableDiscord: false}) {
        try {
            await this._sendLog("success", opt)
        } catch(err) {
            console.log(`AstridLogger: Error sending success log lmao`, err);
        }
    }
};


const {Logger: AstridLog} = require("./index");
const configInfo = require("./config.json");

const AstridLogger = new AstridLog(configInfo);

// Send a success message
AstridLogger.success({messages: ["Successfully fetched data"]})
// Send an error message
AstridLogger.error({messages: ["Could not fetch api, status code: 500"]})
// Send a named success message
AstridLogger.success({messages: ["This is a named message"], title: "Hello world"})

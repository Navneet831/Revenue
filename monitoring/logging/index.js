// Lightweight enterprise structured JSON logger (dependency-free)
const Logger = {
    info: (message, context) => {
        console.log(
            JSON.stringify(
                Object.assign(
                    {
                        timestamp: new Date().toISOString(),
                        level: 'INFO',
                        message: message
                    },
                    context || {}
                )
            )
        );
    },
    warn: (message, context) => {
        console.warn(
            JSON.stringify(
                Object.assign(
                    {
                        timestamp: new Date().toISOString(),
                        level: 'WARN',
                        message: message
                    },
                    context || {}
                )
            )
        );
    },
    error: (message, error, context) => {
        console.error(
            JSON.stringify(
                Object.assign(
                    {
                        timestamp: new Date().toISOString(),
                        level: 'ERROR',
                        message: message,
                        error: error ? error.message : null,
                        stack: error ? error.stack : null
                    },
                    context || {}
                )
            )
        );
    }
};

export default Logger;

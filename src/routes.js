// routes.js
const { registerHandler, loginHandler, editAccountHandler } = require('./handler');

const routes = [
    {
        method: 'POST',
        path: '/register',
        handler: registerHandler
    },
    {
        method: 'POST',
        path: '/login',
        handler: loginHandler
    },
    {
        method: 'PUT',
        path: '/edit-account',
        options: {
            payload: {
                output: 'stream',
                parse: true,
                allow: 'multipart/form-data',
                multipart: true // This is important
            }
        },
        handler: editAccountHandler
    }
];

module.exports = routes;

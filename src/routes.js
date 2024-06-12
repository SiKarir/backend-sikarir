const { registerHandler, loginHandler, editAccountHandler } = require('./handler');

const routes = [
  {
    method: 'POST',
    path: '/register',
    handler: registerHandler,
  },
  {
    method: 'POST',
    path: '/login',
    handler: loginHandler,
  },
  {
    method: 'PUT',
    path: '/edit-account',
    config: {
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data',
        multipart: true,
        maxBytes: 1024 * 1024 * 5, // Batasi ukuran file (contoh: 5MB)
      },
    },
    handler: editAccountHandler,
  },
];

module.exports = routes;

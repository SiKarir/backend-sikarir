//server.js

const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert'); // Plugin untuk menyajikan file statis
const routes = require('./routes');
const Vision = require('@hapi/vision');
const HapiSwagger = require('hapi-swagger');

const init = async () => {

    const server = Hapi.server({
        port: process.env.PORT,
        host: '0.0.0.0',
        routes: {
            cors: {
              origin: ['*'],
                },
        },
    });

  // Daftarkan plugin Inert dan Vision
  await server.register([
    Inert,
    Vision,
    {
        plugin: HapiSwagger,
        options: {
            info: {
                title: 'siKarir API Documentation',
                version: '1.0.0',
            },
        }
    }
]);
  server.route(routes);

  await server.start();
  console.log('Server berjalan di %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert'); // Plugin untuk menyajikan file statis
const routes = require('./routes');

const init = async () => {
  const server = Hapi.server({
    port: 5000,
    host: 'localhost',
  });

  // Daftarkan plugin Inert untuk menyajikan file statis
  await server.register(Inert);
  server.route(routes);

  await server.start();
  console.log('Server berjalan di %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();

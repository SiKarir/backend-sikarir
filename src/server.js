// server.js
const Hapi = require('@hapi/hapi');
const routes = require('./routes');
const Inert = require('@hapi/inert'); // Import plugin Inert

const init = async () => {
    const server = Hapi.server({
        port: 5000,
        host: 'localhost'
    });

    // Daftarkan plugin Inert
    await server.register(Inert);

    server.route(routes);

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();

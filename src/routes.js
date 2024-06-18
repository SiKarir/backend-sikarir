const { registerHandler, loginHandler, editAccountHandler, getAllMajorsHandler, getAllCareersHandler, searchCareersHandler, searchMajorsHandler, processQuizResultsHandler, getRandomMajorsHandler, getQuizHistoryByUserIdHandler } = require('./handler');

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
        method: 'POST',
        path: '/quiz',
        handler: processQuizResultsHandler
    },
    {
        method: 'GET',
        path: '/quiz/history',
        handler: getQuizHistoryByUserIdHandler
    },
    {
        method: 'PUT',
        path: '/edit-account',
        options: {
            payload: {
                output: 'stream',
                parse: true,
                allow: 'multipart/form-data',
                multipart: true
            }
        },
        handler: editAccountHandler
    },
    {
        method: 'GET',
        path: '/catalog/majors',
        handler: getAllMajorsHandler
    },
    {
        method: 'GET',
        path: '/catalog/careers',
        handler: getAllCareersHandler
    },
    {
        method: 'GET',
        path: '/search/majors',
        handler: searchMajorsHandler
    },
    {
        method: 'GET',
        path: '/search/careers',
        handler: searchCareersHandler
    },
    {
        method: 'GET',
        path: '/catalog/majors/random',
        handler: getRandomMajorsHandler
    }
];

module.exports = routes;

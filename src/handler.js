const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { firestore, storage } = require('../services/storeData');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const Inert = require('@hapi/inert');
const { loadModel, predict } = require('../services/model');

// Skema validasi
const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
});

const loginSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).required()
});

const editAccountSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    file: Joi.any()
        .optional()
        .description('Image to upload')
});

const quizResultSchema = Joi.object().pattern(
    Joi.number().integer().required(),
    Joi.string().required()
);

    
const makeModelReadyData = (dataList) => {
    // calculate OCEAN Score (Big Five Personality Test)
    const o_score = ((6*3)-dataList[9] - dataList[19] - dataList[29] + dataList[4] + dataList[14] + dataList[24] + dataList[34] + dataList[39] + dataList[44] + dataList[49]) / 4;
    const c_score = ((6*4)-dataList[7] - dataList[17] - dataList[27] - dataList[37] + dataList[2] + dataList[12] + dataList[22] + dataList[32] + dataList[42] + dataList[47]) / 4;
    const e_score = ((6*5)-dataList[5] - dataList[15] - dataList[25] - dataList[35] - dataList[45] + dataList[0] + dataList[10] + dataList[20] + dataList[30] + dataList[40]) / 4;
    const a_score = ((6*4)-dataList[1] - dataList[11] - dataList[21] - dataList[31] + dataList[6] + dataList[16] + dataList[26] + dataList[36] + dataList[41] + dataList[46]) / 4;
    const n_score = ((6*8)-dataList[3] - dataList[13] - dataList[23] - dataList[28] - dataList[33] - dataList[38] - dataList[43] - dataList[48] + dataList[8] + dataList[18]) / 4;
    
    // calculate aptitude score
    const rightAnswers = ["C", "D", "C", "B", "C", "B", "E", "B", "C", "B", // numerical aptitude
                          "B", "C", "A", "B", "C", "B", "A", "A", "D", "D", // spatial aptitude
                          "B", "A", "E", "C", "E", "A", "D", "A", "E", "B", // abstract reasoning
                          "A", "A", "B", "C", "A", "B", "C", "A", "B", "A", // verbal reasoning
                          "B", "D", "C", "B", "A", "B", "B", "B", "A", "A" // perceptual aptitude
                         ];

    const score = [];
    for (let i = 50, j = 0; i < dataList.length; i++, j++) {
        if (dataList[i] === rightAnswers[j]) {
            score.push(1);
        } else {
            score.push(0);
        }
    }

    // calculate total score
    const numerical_aptitude = score.slice(0, 10).reduce((acc, val) => acc + val, 0);
    const spatial_aptitude = score.slice(11, 20).reduce((acc, val) => acc + val, 0);
    const abstract_reasoning = score.slice(21, 30).reduce((acc, val) => acc + val, 0);
    const verbal_reasoning = score.slice(31, 40).reduce((acc, val) => acc + val, 0);
    const perceptual_aptitude = score.slice(41, 50).reduce((acc, val) => acc + val, 0);

    const modelReadyData = {
        o_score: o_score,
        c_score: c_score,
        e_score: e_score,
        a_score: a_score,
        n_score: n_score,
        numerical_aptitude: numerical_aptitude,
        spatial_aptitude: spatial_aptitude,
        perceptual_aptitude: perceptual_aptitude,
        abstract_reasoning: abstract_reasoning,
        verbal_reasoning: verbal_reasoning
    };

    return modelReadyData;
}


// Fungsi untuk meng-upload foto ke Firebase Storage dan mendapatkan URL publik
const uploadPhoto = (file) => {
    return new Promise((resolve, reject) => {
        const bucketName = 'sikarir-profile-photos';
        const fileName = `${Date.now()}-${file.hapi.filename}`;

        const blob = storage.bucket(bucketName).file(fileName);
        const blobStream = blob.createWriteStream({ resumable: false });

        file.pipe(blobStream);

        blobStream.on('finish', async () => {
            try {
                await blob.makePublic();
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                resolve(publicUrl);
            } catch (error) {
                reject(error);
            }
        });

        blobStream.on('error', (error) => {
            reject(error);
        });
    });
};

// Fungsi untuk mendapatkan rekomendasi karir dan jurusan terkait
async function getCareerAndMajorRecommendation(userData) {
    const model = await loadModel();
  
    const numericData = Object.values(userData).map(Number); 
  
    const predictionResult = await predict(model, numericData);

    const resultDictionary = {};
    predictionResult.forEach((value, index) => {
        resultDictionary[index] = value;
    });

    const top5Entries = Object.entries(resultDictionary).sort(([, a], [, b]) => b - a).slice(0, 5);

    const careerDictionary = {
        0: "Accountant",
        1: "Administrative Officer",
        2: "Advertising Manager",
        3: "Aerospace Engineer",
        4: "Air Traffic Controller",
        5: "Architect",
        6: "Artist",
        7: "Astronomer",
        8: "Auditor",
        9: "Biologist",
        10: "Biomedical Engineer",
        11: "Biomedical Researcher",
        12: "Biotechnologist",
        13: "Chef",
        14: "Civil Engineer",
        15: "Communication Specialist",
        16: "Construction Engineer",
        17: "Copywriter",
        18: "Customs and Border Protection Officer",
        19: "Data Analyst",
        20: "Database Specialist",
        21: "Diplomat",
        22: "Doctor",
        23: "Electrical Engineer",
        24: "Environmental Engineer",
        25: "Environmental Scientist",
        26: "Event Planner",
        27: "Fashion Designer",
        28: "Fashion Stylist",
        29: "Film Director",
        30: "Financial Advisor",
        31: "Financial Analyst",
        32: "Financial Planner",
        33: "Forestry Technician",
        34: "Game Developer",
        35: "Geologist",
        36: "Graphic Designer",
        37: "Human Resources Manager",
        38: "IT Specialist",
        39: "Industrial Engineer",
        40: "Insurance Underwriter",
        41: "Investment Banker",
        42: "Journalist",
        43: "Lawyer",
        44: "Market Analyst",
        45: "Marketing Manager",
        46: "Mechanical Designer",
        47: "Mechanical Engineer",
        48: "Musician",
        49: "Nurse",
        50: "Pharmacist",
        51: "Photographer",
        52: "Pilot",
        53: "Police",
        54: "Product Manager",
        55: "Project Manager",
        56: "Psychologist",
        57: "Public Health Analyst",
        58: "Quality Control/Quality Assurance",
        59: "Radiologic Technologist",
        60: "Real Estate Agent",
        61: "Rehabilitation Counselor",
        62: "Research Scientist",
        63: "Robotics Engineer",
        64: "Salesperson",
        65: "Social Media Manager",
        66: "Social Worker",
        67: "Software Developer",
        68: "Speech Therapist",
        69: "Sports Coach",
        70: "Teacher",
        71: "Therapist",
        72: "Urban Planner",
        73: "Web Developer",
        74: "Wildlife Conservationist",
        75: "Writer"
    };

    const top5Careers = top5Entries.map(([index]) => careerDictionary[index]);

    const careerSnapshot = await firestore.collection('careers').get();
    const listCareer = careerSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    const majorSnapshot = await firestore.collection('majors').get();
    const listMajor = majorSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().Major,
        description: doc.data().Deskripsi,
        photoUrl: doc.data().Photo,
        university: doc.data().University
    }));

    const careersWithRelatedMajors = listCareer.map(career => {
        const careerKeywords = career.Keywords.map(keyword => keyword.trim().toLowerCase());

        const relatedMajors = listMajor.filter(major =>
            careerKeywords.some(keyword => major.name.toLowerCase().includes(keyword))
        );

        const limitedRelatedMajors = relatedMajors.slice(0, 6);

        return {
            id: career.id,
            name: career.Career,
            description: career.Deskripsi,
            photoUrl: career.Link || 'https://github.com/SiKarir/image-quiz-storage/assets/112604705/7d7e6f4d-625d-4704-8456-af4f8d652a22',
            listJurusanTerkait: limitedRelatedMajors.map(major => ({
                id: major.id,
                name: major.name,
                description: major.description,
                photoUrl: major.photoUrl,
                listUniversitasTerkait: major.university
            }))
        };
    });

    const recommendedCareers = careersWithRelatedMajors.filter(career => top5Careers.includes(career.name));
    return recommendedCareers;
  }

// Handler to process quiz results and calculate model-ready data
const processQuizResultsHandler = async (request, h) => {
    const { authorization } = request.headers;

    if (!authorization) {
        return h.response({ error: true, message: 'Authorization header missing' }).code(401);
    }

    const token = authorization.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, 'your_jwt_secret');
    } catch (err) {
        return h.response({ error: true, message: 'Invalid token' }).code(401);
    }

    const { error } = quizResultSchema.validate(request.payload);

    if (error) {
        return h.response({ error: true, message: error.details[0].message }).code(400);
    }

    const quizResults = request.payload;

    if (Object.keys(quizResults).length !== 100) {
        return h.response({ error: true, message: 'Quiz results must contain exactly 100 entries' }).code(400);
    }

    // Sort quiz results by key
    const sortedResults = Object.keys(quizResults).sort((a, b) => a - b).map(key => quizResults[key]);

    // Convert the values from index 0-49 to integers
    const convertedResults = sortedResults.map((value, index) => index < 50 ? parseInt(value) : value);

    console.log(convertedResults.toLocaleString())

    // Calculate model-ready data
    const modelReadyData = makeModelReadyData(convertedResults);

    try {
        // Ubah modelReadyData menjadi array numerik
        const numericData = Object.values(modelReadyData).map(Number);
        const recommendation = await getCareerAndMajorRecommendation(numericData);  // Gunakan numericData

        const userRef = firestore.collection('users').doc(decoded.userId);
        await userRef.update({ isTakenQuiz: true });
        const quizId = uuidv4();
        const quizDate = new Date().toISOString();

        const quizEntity = {
            quizId,
            userId: decoded.userId,
            date: quizDate,
            recommendation,
        };

        await firestore.collection('quizzes').doc(quizId).set(quizEntity);
        return h.response({ error: false, recommendation, quizId, quizDate }).code(200);
      } catch (error) {
        return h.response({ error: true, message: 'Failed to get recommendation' }).code(500);
      }
    };
    
// Handler untuk mendaftarkan pengguna baru
const registerHandler = async (request, h) => {
    const { error } = registerSchema.validate(request.payload);

    if (error) {
        return h.response({ error: true, message: error.details[0].message }).code(400);
    }

    const { username, name, email, password } = request.payload;

    try {
        const usernameQuerySnapshot = await firestore.collection('users').where('username', '==', username).get();
        const emailQuerySnapshot = await firestore.collection('users').where('email', '==', email).get();

        if (!usernameQuerySnapshot.empty || !emailQuerySnapshot.empty) {
            return h.response({ error: true, message: 'Username or Email already exists' }).code(400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        const formattedName = name.split(' ').join('+');
        const urlPhoto = `https://eu.ui-avatars.com/api/?name=${formattedName}&size=250;`

        const userRef = firestore.collection('users').doc(userId);
        await userRef.set({
            username,
            name,
            email,
            photoUrl: urlPhoto,
            password: hashedPassword,
            isTakenQuiz: false
        });

        return h.response({ error: false, message: 'User Created', userId }).code(201);
    } catch (error) {
        console.error('Error adding user to Firestore:', error);
        return h.response({ error: true, message: 'Failed to create user' }).code(500);
    }
};

// Handler untuk login pengguna
const loginHandler = async (request, h) => {
    const { error } = loginSchema.validate(request.payload);

    if (error) {
        return h.response({ error: true, message: error.details[0].message }).code(400);
    }

    const { username, password } = request.payload;

    try {
        const userQuerySnapshot = await firestore.collection('users').where('username', '==', username).get();

        if (userQuerySnapshot.empty) {
            return h.response({ error: true, message: 'Invalid username or password' }).code(401);
        }

        const userDoc = userQuerySnapshot.docs[0];
        const userData = userDoc.data();

        const isValid = await bcrypt.compare(password, userData.password);
        if (!isValid) {
            return h.response({ error: true, message: 'Invalid username or password' }).code(401);
        }

        const token = jwt.sign({ userId: userDoc.id }, 'your_jwt_secret', { expiresIn: '1h' });

        return h.response({
            error: false,
            message: 'success',
            loginResult: {
                userId: userDoc.id,
                name: userData.name,
                photoUrl: userData.photoUrl,
                email: userData.email,
                isTakenQuiz: userData.isTakenQuiz,
                photoUrl: userData.photoUrl,
                token
            }
        }).code(200);
    } catch (error) {
        console.error('Error fetching user from Firestore:', error);
        return h.response({ error: true, message: 'Internal Server Error' }).code(500);
    }
};
// Handler untuk mengedit akun pengguna
const editAccountHandler = async (request, h) => {
    const { authorization } = request.headers;

    if (!authorization) {
        return h.response({ error: true, message: 'Authorization header missing' }).code(401);
    }

    const token = authorization.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, 'your_jwt_secret');
    } catch (err) {
        return h.response({ error: true, message: 'Invalid token' }).code(401);
    }

    const { error } = editAccountSchema.validate(request.payload);

    if (error) {
        return h.response({ error: true, message: error.details[0].message }).code(400);
    }

    try {
        const userRef = firestore.collection('users').doc(decoded.userId);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return h.response({ error: true, message: 'User not found' }).code(404);
        }

        const { username, name, email, password, file } = request.payload;

        let photoUrl = file ? await uploadPhoto(file) : userSnapshot.data().photoUrl;
        let updatedData = {
            username: username || userSnapshot.data().username,
            name: name || userSnapshot.data().name,
            email: email || userSnapshot.data().email,
            password: password ? await bcrypt.hash(password, 10) : userSnapshot.data().password,
            photoUrl
        };

        // Remove undefined fields
        Object.keys(updatedData).forEach(key => {
            if (updatedData[key] === undefined) {
                delete updatedData[key];
            }
        });

        await userRef.update(updatedData);

        return h.response({
            error: false,
            message: 'User Updated',
            user: {
                username: updatedData.username,
                name: updatedData.name,
                email: updatedData.email,
                photoUrl: updatedData.photoUrl,
                userId: updatedData.id,
                isTakenQuiz: updatedData.isTakenQuiz
            }
        }).code(200);
    } catch (error) {
        console.error('Error updating user:', error);
        return h.response({ error: true, message: 'Failed to update user' }).code(500);
    }
};

// Handler untuk mendapatkan semua jurusan
const getAllMajorsHandler = async (request, h) => {
    try {
        // Retrieve optional paging parameters from the request query
        const page = parseInt(request.query.page) || null; // null if not provided
        const size = parseInt(request.query.size) || null; // null if not provided

        const snapshot = await firestore.collection('majors').get();
        const listMajor = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().Major,
            description: doc.data().Deskripsi,
            photoUrl: doc.data().Photo,
            listUniversitasTerkait: doc.data().University
        }));

        // Handle optional paging
        let paginatedMajors;
        let totalPages = 1;

        if (page !== null && size !== null) {
            // Calculate the start and end index for pagination
            const startIndex = (page - 1) * size;
            const endIndex = startIndex + size;

            // Slice the majors array to return only the requested page
            paginatedMajors = listMajor.slice(startIndex, endIndex);
            totalPages = Math.ceil(listMajor.length / size);
        } else {
            // If no paging parameters provided, return all majors
            paginatedMajors = listMajor;
        }

        return h.response({
            error: false,
            message: 'Majors fetched successfully',
            listMajor: paginatedMajors,
            currentPage: page !== null ? page : 1,
            totalPages: totalPages,
            totalMajors: listMajor.length
        }).code(200);
    } catch (error) {
        console.error('Error fetching majors from Firestore:', error);
        return h.response({ error: true, message: 'Failed to fetch majors' }).code(500);
    }
};


// Handler untuk mendapatkan semua karir
const getAllCareersHandler = async (request, h) => {
    try {
        // Retrieve optional paging parameters from the request query
        const page = parseInt(request.query.page) || null; // null if not provided
        const size = parseInt(request.query.size) || null; // null if not provided

        const careerSnapshot = await firestore.collection('careers').get();
        const listCareer = careerSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const majorSnapshot = await firestore.collection('majors').get();
        const listMajor = majorSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().Major,
            description: doc.data().Deskripsi,
            photoUrl: doc.data().Photo,
            university: doc.data().University
        }));

        const careersWithRelatedMajors = listCareer.map(career => {
            const careerKeywords = career.Keywords.map(keyword => keyword.trim().toLowerCase());

            const relatedMajors = listMajor.filter(major =>
                careerKeywords.some(keyword => major.name.toLowerCase().includes(keyword))
            );

            const limitedRelatedMajors = relatedMajors.slice(0, 6);

            return {
                id: career.id,
                name: career.Career,
                description: career.Deskripsi,
                photoUrl: career.Link || 'https://github.com/SiKarir/image-quiz-storage/assets/112604705/7d7e6f4d-625d-4704-8456-af4f8d652a22',
                listJurusanTerkait: limitedRelatedMajors.map(major => ({
                    id: major.id,
                    name: major.name,
                    description: major.description,
                    photoUrl: major.photoUrl,
                    listUniversitasTerkait: major.university
                }))
            };
        });

        // Handle optional paging
        let paginatedCareers;
        let totalPages = 1;

        if (page !== null && size !== null) {
            // Calculate the start and end index for pagination
            const startIndex = (page - 1) * size;
            const endIndex = startIndex + size;

            // Slice the careers array to return only the requested page
            paginatedCareers = careersWithRelatedMajors.slice(startIndex, endIndex);
            totalPages = Math.ceil(careersWithRelatedMajors.length / size);
        } else {
            // If no paging parameters provided, return all careers
            paginatedCareers = careersWithRelatedMajors;
        }

        return h.response({
            error: false,
            message: 'Careers fetched successfully',
            listCareer: paginatedCareers,
            currentPage: page !== null ? page : 1,
            totalPages: totalPages,
            totalCareers: careersWithRelatedMajors.length
        }).code(200);
    } catch (error) {
        console.error('Error fetching careers and majors from Firestore:', error);
        return h.response({ error: true, message: 'Failed to fetch careers' }).code(500);
    }
};

const searchMajorsHandler = async (request, h) => {
    try {
        // Retrieve the search query from the request query
        const searchQuery = request.query.q ? request.query.q.toLowerCase() : '';

        const snapshot = await firestore.collection('majors').get();
        let listMajor = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().Major,
            description: doc.data().Deskripsi,
            photoUrl: doc.data().Photo,
            listUniversitasTerkait: doc.data().University
        }));

        // Filter majors based on search query
        if (searchQuery) {
            listMajor = listMajor.filter(major =>
                major.name.toLowerCase().includes(searchQuery)
            );
        }

        return h.response({
            error: false,
            message: 'Majors fetched successfully',
            listMajor
        }).code(200);
    } catch (error) {
        console.error('Error searching majors from Firestore:', error);
        return h.response({ error: true, message: 'Failed to fetch majors' }).code(500);
    }
};

const searchCareersHandler = async (request, h) => {
    try {
        // Retrieve the search query from the request query
        const searchQuery = request.query.q ? request.query.q.toLowerCase() : '';

        const careerSnapshot = await firestore.collection('careers').get();
        const listCareer = careerSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const majorSnapshot = await firestore.collection('majors').get();
        const listMajor = majorSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().Major,
            description: doc.data().Deskripsi,
            photoUrl: doc.data().Photo,
            university: doc.data().University
        }));

        let careersWithRelatedMajors = listCareer.map(career => {
            const careerKeywords = career.Keywords.map(keyword => keyword.trim().toLowerCase());

            const relatedMajors = listMajor.filter(major =>
                careerKeywords.some(keyword => major.name.toLowerCase().includes(keyword))
            );

            const limitedRelatedMajors = relatedMajors.slice(0, 6);

            return {
                id: career.id,
                name: career.Career,
                description: career.Deskripsi,
                photoUrl: career.Link || 'https://github.com/SiKarir/image-quiz-storage/assets/112604705/7d7e6f4d-625d-4704-8456-af4f8d652a22',
                listJurusanTerkait: limitedRelatedMajors.map(major => ({
                    id: major.id,
                    name: major.name,
                    description: major.description,
                    photoUrl: major.photoUrl,
                    listUniversitasTerkait: major.university
                }))
            };
        });

        // Filter careers based on search query
        if (searchQuery) {
            careersWithRelatedMajors = careersWithRelatedMajors.filter(career =>
                career.name.toLowerCase().includes(searchQuery)
            );
        }

        return h.response({
            error: false,
            message: 'Careers fetched successfully',
            listCareer: careersWithRelatedMajors
        }).code(200);
    } catch (error) {
        console.error('Error searching careers from Firestore:', error);
        return h.response({ error: true, message: 'Failed to fetch careers' }).code(500);
    }
};

const getRandomMajorsHandler = async (request, h) => {
    try {
        const snapshot = await firestore.collection('majors').get();
        const listMajor = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().Major,
            description: doc.data().Deskripsi,
            photoUrl: doc.data().Photo,
            listUniversitasTerkait: doc.data().University
        }));

        for (let i = listMajor.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [listMajor[i], listMajor[j]] = [listMajor[j], listMajor[i]];
        }

        const randomMajors = listMajor.slice(0, 5);

        return h.response({
            error: false,
            message: 'Random majors fetched successfully',
            listMajor: randomMajors,
            totalMajors: listMajor.length
        }).code(200);
    } catch (error) {
        console.error('Error fetching random majors from Firestore:', error);
        return h.response({ error: true, message: 'Failed to fetch random majors' }).code(500);
    }
};

const getQuizHistoryByUserIdHandler = async (request, h) => {
    const { authorization } = request.headers;

    if (!authorization) {
        return h.response({ error: true, message: 'Authorization header missing' }).code(401);
    }

    const token = authorization.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, 'your_jwt_secret');
    } catch (err) {
        return h.response({ error: true, message: 'Invalid token' }).code(401);
    }

    const userId = decoded.userId;

    try {
        const quizzesSnapshot = await firestore.collection('quizzes').where('userId', '==', userId).get();

        if (quizzesSnapshot.empty) {
            return h.response({ error: false, message: 'No quiz history found', quizzes: [] }).code(200);
        }

        const quizzes = quizzesSnapshot.docs.map(doc => doc.data());

        return h.response({ error: false, quizzes }).code(200);
    } catch (error) {
        console.error('Error fetching quiz history:', error);
        return h.response({ error: true, message: 'Failed to fetch quiz history' }).code(500);
    }
};


module.exports = { registerHandler, loginHandler, editAccountHandler, getAllMajorsHandler, getAllCareersHandler, searchMajorsHandler, searchCareersHandler, processQuizResultsHandler, getRandomMajorsHandler, getQuizHistoryByUserIdHandler};
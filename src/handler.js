const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { firestore, storage } = require('../services/storeData');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const Inert = require('@hapi/inert'); // Import plugin Inert

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
    file: Joi.optional()
        .meta({ swaggerType: 'file' })
        .description('Image to upload')
        .optional()
});

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
        const urlPhoto = "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250";

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

        return h.response({ error: false, message: 'User Updated' }).code(200);
    } catch (error) {
        console.error('Error updating user:', error);
        return h.response({ error: true, message: 'Failed to update user' }).code(500);
    }
};

// Handler untuk mendapatkan semua jurusan
const getAllMajorsHandler = async (request, h) => {
  try {
      // Get all document IDs
      const snapshot = await firestore.collection('majors').listDocuments();

      // Retrieve all documents
      const listMajor = [];
      for (const docRef of snapshot) {
          const doc = await docRef.get();
          if (doc.exists) {
              listMajor.push(doc.data());
          }
      }

      return h.response({
          error: false,
          message: 'Majors fetched successfully',
          listMajor
      }).code(200);
  } catch (error) {
      console.error('Error fetching majors from Firestore:', error);
      return h.response({ error: true, message: 'Failed to fetch majors' }).code(500);
  }
};

// Handler untuk mendapatkan semua karir
const getAllCareersHandler = async (request, h) => {
    const { page = 1, size = 10 } = request.query;
    const start = (page - 1) * size;

    try {
        const snapshot = await firestore.collection('careers').orderBy('name').offset(start).limit(size).get();
        const listCareer = snapshot.docs.map(doc => doc.data());

        return h.response({
            error: false,
            message: 'Careers fetched successfully',
            listCareer
        }).code(200);
    } catch (error) {
        console.error('Error fetching careers from Firestore:', error);
        return h.response({ error: true, message: 'Failed to fetch careers' }).code(500);
    }
};

module.exports = { registerHandler, loginHandler, editAccountHandler, getAllMajorsHandler, getAllCareersHandler };
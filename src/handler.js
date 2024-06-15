const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {firestore, storage} = require('../services/storeData');
const Joi = require('joi');
const Inert = require('@hapi/inert'); // Import plugin Inert

//const users = []; // This array will act as our in-memory database for this example

// Skema validasi
const registerSchema = Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required() // Password must be at least 8 characters long
    });

const loginSchema = Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        password: Joi.string().min(8).required(),
      });
      
const editAccountSchema = Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        file: Joi.optional()
          .meta({ swaggerType: 'file' })
          .description('Image to upload')
          .optional(),
      });
    
    const registerHandler = async (request, h) => {
        // Validate the request payload
        const { error } = registerSchema.validate(request.payload);
    
        if (error) {
            return h.response({ error: true, message: error.details[0].message }).code(400);
        }
    
        const { username, name, email, password } = request.payload;
    
        // Check if username or email already exists
        try {
            // Check if username or email already exists in Firestore
            const usernameQuerySnapshot = await firestore.collection('users').where('username', '==', username).get();
            const emailQuerySnapshot = await firestore.collection('users').where('email', '==', email).get();
            // Check if the query returned any documents
            if (!usernameQuerySnapshot.empty || !emailQuerySnapshot.empty) { 
                return h.response({ error: true, message: 'Username or Email already exists' }).code(400);
            }
    
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
    
             // Store user in Firestore
            const userRef = await firestore.collection('users').doc(username);
            await userRef.set({
                username,
                name,
                email,
                password: hashedPassword
        });
            // Include the generated Firestore document ID in the response
            return h.response({ error: false, message: 'User Created', userId: userRef.id }).code(201);
        } catch (error) {
            console.error('Error adding user to Firestore:', error);
            return h.response({ error: true, message: 'Failed to create user' }).code(500); 
        }
    };

    const loginHandler = async (request, h) => {
        const { error } = loginSchema.validate(request.payload);
    
        if (error) {
            return h.response({ error: true, message: error.details[0].message }).code(400);
        }
    
        const { username, password } = request.payload;
    
        try {
            // Query Firestore untuk mencari pengguna dengan username yang sesuai
            const userQuerySnapshot = await firestore.collection('users').where('username', '==', username).get();
    
            if (userQuerySnapshot.empty) {
                return h.response({ error: true, message: 'Invalid username or password' }).code(401);
            }
    
            const userDoc = userQuerySnapshot.docs[0];
            const userData = userDoc.data();
    
            // Periksa apakah password yang diberikan cocok
            const isValid = await bcrypt.compare(password, userData.password);
            if (!isValid) {
                return h.response({ error: true, message: 'Invalid username or password' }).code(401);
            }
    
            // Generate JWT token
            const token = jwt.sign({ userId: userDoc.id }, 'your_jwt_secret', { expiresIn: '1h' });
    
            return h.response({
                error: false,
                message: 'success',
                loginResult: {
                    userId: userDoc.id, // Gunakan ID dari Firestore
                    name: userData.name,
                    isTakenQuiz: false, // Sesuaikan jika diperlukan
                    token
                }
            }).code(200);
        } catch (error) {
            console.error('Error fetching user from Firestore:', error);
            return h.response({ error: true, message: 'Internal Server Error' }).code(500);
        }
    };
    
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
      
        // Initialize variables to hold form data
        let username, name, email, password;
      
        try {
          // Temukan dokumen pengguna di Firestore berdasarkan userId dari token
          const userRef = firestore.collection('users').doc(decoded.userId);
          const userSnapshot = await userRef.get();
      
          if (!userSnapshot.exists) {
            return h.response({ error: true, message: 'User not found' }).code(404);
          }
      
          // Handle file upload (jika ada)
          /*if (request.payload.file) {
            const file = request.payload.file;
            const bucketName = 'sikarir-profile-photos'; // Ganti dengan nama bucket GCS Anda
            const fileName = `${Date.now()}-${file.hapi.filename}`;
      
            const blob = storage.bucket(bucketName).file(fileName);
            const blobStream = blob.createWriteStream({
              resumable: false,
            });
      
            file.pipe(blobStream);
      
            await new Promise((resolve, reject) => {
              blobStream.on('finish', async () => {
                // Membuat file menjadi public
                await blob.makePublic();
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                dataToUpdate.photoUrl = publicUrl;
                resolve();
              });
              blobStream.on('error', reject);
            });
          }*/
      
          // Retrieve form fields
          username = request.payload.username || userSnapshot.data().username; // Use existing if not provided
          name = request.payload.name || userSnapshot.data().name;           // Use existing if not provided
          email = request.payload.email || userSnapshot.data().email;         // Use existing if not provided
          password = request.payload.password || userSnapshot.data().password; // Use existing if not provided
      
          // Check if email is already in use by another user (if email is changed)
          if (email !== userSnapshot.data().email) {
            const emailQuerySnapshot = await firestore.collection('users').where('email', '==', email).get();
            if (!emailQuerySnapshot.empty && emailQuerySnapshot.docs[0].id !== decoded.userId) {
              return h.response({ error: true, message: 'Email already in use' }).code(400);
            }
          }
      
          // Check if username is already in use by another user (if username is changed)
          if (username !== userSnapshot.data().username) {
            const usernameQuerySnapshot = await firestore.collection('users').where('username', '==', username).get();
            if (!usernameQuerySnapshot.empty && usernameQuerySnapshot.docs[0].id !== decoded.userId) {
              return h.response({ error: true, message: 'Username already in use' }).code(400);
            }
          }
      
          // Hash new password (if password is changed)
          if (password !== userSnapshot.data().password) {
            password = await bcrypt.hash(password, 10);
          }
      
          // Update user details in Firestore
          const dataToUpdate = {
            username,
            name,
            email,
            password,
          };
          
          await userRef.update(dataToUpdate);
      
          return h.response({ error: false, message: 'User Updated' }).code(200);
      
        } catch (error) {
          console.error('Error updating user:', error);
          return h.response({ error: true, message: 'Failed to update user' }).code(500);
        }
      };
      
    

module.exports = { registerHandler, loginHandler, editAccountHandler };

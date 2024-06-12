const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');

const users = []; // Database pengguna sementara

// Skema validasi
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
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
  file: Joi.any()
    .meta({ swaggerType: 'file' })
    .description('Image to upload')
    .optional(),
});

// Handler untuk register
const registerHandler = async (request, h) => {
  const { payload } = request;

  const { error } = registerSchema.validate(payload);
  if (error) {
    return h.response({ error: true, message: error.details[0].message }).code(400);
  }

  const { username, name, email, password } = payload;

  // Check if username or email already exists
  const userExists = users.find(
    (user) => user.username === username || user.email === email
  );
  if (userExists) {
    return h
      .response({ error: true, message: 'Username atau email sudah terdaftar' })
      .code(400);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = {
    id: `user-${Date.now()}`,
    username,
    name,
    email,
    password: hashedPassword,
  };
  users.push(user);

  return h.response({ error: false, message: 'User berhasil dibuat' }).code(201);
};

// Handler untuk login
const loginHandler = async (request, h) => {
  const { payload } = request;

  const { error } = loginSchema.validate(payload);
  if (error) {
    return h.response({ error: true, message: error.details[0].message }).code(400);
  }
  
  const { username, password } = payload;

  // Find user by username
  const user = users.find((user) => user.username === username);
  if (!user) {
    return h
      .response({ error: true, message: 'Username atau password salah' })
      .code(401);
  }

  // Check password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return h
      .response({ error: true, message: 'Username atau password salah' })
      .code(401);
  }

  // Generate JWT token
  const token = jwt.sign({ userId: user.id }, 'your_jwt_secret', { expiresIn: '1h' });

  return h.response({
    error: false,
    message: 'success',
    loginResult: {
      userId: user.id,
      name: user.name,
      isTakenQuiz: false, // Assuming default value for this example
      token,
    },
  }).code(200);
};

// Handler untuk edit account
const editAccountHandler = async (request, h) => {
  const { payload } = request;
  const { username, name, email, password, file } = payload;

  // Validasi data menggunakan Joi
  const { error } = editAccountSchema.validate(payload);
  if (error) {
    return h.response({ error: true, message: error.details[0].message }).code(400);
  }

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

  // Find user by username
  const userIndex = users.findIndex((user) => user.username === username);
  if (userIndex === -1) {
    return h.response({ error: true, message: 'User not found' }).code(404);
  }

  // Ensure the authenticated user is editing their own account
  if (users[userIndex].id !== decoded.userId) {
    return h.response({ error: true, message: 'Unauthorized' }).code(403);
  }

  // Check if email is already in use by another user
  const emailExists = users.some((user) => user.email === email && user.username !== username);
  if (emailExists) {
    return h.response({ error: true, message: 'Email already in use' }).code(400);
  }

  // Handle file upload (jika ada)
  if (file) {
    const filename = Date.now() + '-' + file.hapi.filename;
    const uploadPath = path.join(__dirname, '../uploads', filename);

    // Ensure 'uploads' directory exists
    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
      fs.mkdirSync(path.join(__dirname, '../uploads'));
    }

    const fileStream = fs.createWriteStream(uploadPath);
    file.pipe(fileStream);

    await new Promise((resolve, reject) => {
      file.on('end', resolve);
      file.on('error', reject);
    });

    // Simpan nama file ke data pengguna
    users[userIndex].profilePicture = filename;
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Update user details
  users[userIndex] = {
    ...users[userIndex],
    name,
    email,
    password: hashedPassword,
  };

  return h.response({ error: false, message: 'User Updated' }).code(200);
};

module.exports = { registerHandler, loginHandler, editAccountHandler };

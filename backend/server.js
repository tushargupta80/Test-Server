const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 4002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'quiz_platform';
const roles = ['student', 'teacher', 'admin'];

const defaultUsers = [
  {
    id: 'user-student-1',
    username: 'student1',
    name: 'Student Demo',
    role: 'student',
    salt: '334e1fe34278b39bbd8f5b8601df3c33',
    passwordHash:
      'ae50d27c60a6a8672f3be7a15180864c8a93424177acf7f5dd61b67db6b53b2c66441e94c0e24fff203319feb3f41220837215630f6444901f063a803cef5989',
  },
  {
    id: 'user-teacher-1',
    username: 'teacher1',
    name: 'Teacher Demo',
    role: 'teacher',
    salt: '1936a2c56c1a0ab308a0a9a0bef8e182',
    passwordHash:
      'd241d915759edd3cab12de4dde7bf609ff486529142aaeedc4460da4ecfa53105e157fbfee0e77709d309e62c80c5e981a8ef60bccc89b855427c2ad3ef69f0a',
  },
  {
    id: 'user-admin-1',
    username: 'admin1',
    name: 'Admin Demo',
    role: 'admin',
    salt: '35e5cb2a40d1f43a125e5f6934294754',
    passwordHash:
      '298c66c7d60165d56a68d8f5ef17951ead2ec9746685f34a3a02cf75d2dbee831e4f40cce97de5a88c210d593b1838937ca5ddb5fc0469e0149fb1da2905c7e5',
  },
];

const defaultQuizzes = [
  {
    id: 'quiz-js-01',
    title: 'JavaScript Basics',
    description: 'A short quiz covering variables, arrays, and loops.',
    questions: [
      {
        text: 'Which keyword declares a variable that cannot be reassigned?',
        options: ['let', 'const', 'var', 'function'],
        correct: 1,
      },
      {
        text: 'What is the result of [1,2,3].length?',
        options: ['2', '3', 'undefined', '0'],
        correct: 1,
      },
    ],
  },
  {
    id: 'quiz-html-01',
    title: 'HTML Fundamentals',
    description: 'Test your knowledge of HTML tags and structure.',
    questions: [
      {
        text: 'Which tag defines a paragraph?',
        options: ['<div>', '<p>', '<section>', '<span>'],
        correct: 1,
      },
      {
        text: 'What attribute is used to link a stylesheet?',
        options: ['src', 'href', 'rel', 'type'],
        correct: 2,
      },
    ],
  },
];

const sessions = new Map();
const mongoClient = new MongoClient(MONGODB_URI);
let db;

app.use(
  cors({
    origin: true,
    credentials: false,
  })
);
app.use(express.json());

function usersCollection() {
  return db.collection('users');
}

function quizzesCollection() {
  return db.collection('quizzes');
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, passwordHash };
}

function verifyPassword(password, user) {
  const candidateHash = crypto.scryptSync(password, user.salt, 64).toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(user.passwordHash, 'hex')
  );
}

function readToken(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
}

async function readUsers() {
  return usersCollection().find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
}

async function findUserById(id) {
  return usersCollection().findOne({ id }, { projection: { _id: 0 } });
}

async function findUserByUsername(username) {
  return usersCollection().findOne({ username }, { projection: { _id: 0 } });
}

async function readQuizzes() {
  return quizzesCollection().find({}, { projection: { _id: 0 } }).sort({ title: 1 }).toArray();
}

function invalidateUserSessions(userId) {
  for (const [token, session] of sessions.entries()) {
    if (session.user.id === userId) {
      sessions.delete(token);
    }
  }
}

async function ensureDatabaseState() {
  await usersCollection().createIndex({ id: 1 }, { unique: true });
  await usersCollection().createIndex({ username: 1 }, { unique: true });
  await quizzesCollection().createIndex({ id: 1 }, { unique: true });

  const [userCount, quizCount] = await Promise.all([
    usersCollection().countDocuments(),
    quizzesCollection().countDocuments(),
  ]);

  if (userCount === 0) {
    await usersCollection().insertMany(defaultUsers);
  }

  if (quizCount === 0) {
    await quizzesCollection().insertMany(defaultQuizzes);
  }
}

function requireAuth(allowedRoles = roles) {
  return async (req, res, next) => {
    try {
      const token = readToken(req);
      if (!token) {
        return res.status(401).json({ message: 'Authentication required.' });
      }

      const session = sessions.get(token);
      if (!session) {
        return res.status(401).json({ message: 'Session expired or invalid.' });
      }

      const currentUser = await findUserById(session.user.id);

      if (!currentUser) {
        sessions.delete(token);
        return res.status(401).json({ message: 'Your account is no longer available.' });
      }

      if (!allowedRoles.includes(currentUser.role)) {
        return res.status(403).json({ message: 'You do not have access to this action.' });
      }

      const safeUser = sanitizeUser(currentUser);
      sessions.set(token, {
        ...session,
        user: safeUser,
      });

      req.token = token;
      req.user = safeUser;
      next();
    } catch (error) {
      next(error);
    }
  };
}

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await findUserByUsername(username);

    if (!user || !verifyPassword(password, user)) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const safeUser = sanitizeUser(user);
    sessions.set(token, {
      user: safeUser,
      createdAt: Date.now(),
    });

    res.json({
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth(), async (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', requireAuth(), async (req, res) => {
  sessions.delete(req.token);
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/users', requireAuth(['admin']), async (req, res, next) => {
  try {
    const users = await readUsers();
    res.json(users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
});

app.post('/api/users', requireAuth(['admin']), async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const role = String(req.body.role || '').trim().toLowerCase();

    if (!name || !username || !password || !role) {
      return res.status(400).json({ message: 'Name, username, password, and role are required.' });
    }

    if (!roles.includes(role)) {
      return res.status(400).json({ message: 'Role must be student, teacher, or admin.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const usernamePattern = /^[a-zA-Z0-9_.-]+$/;
    if (!usernamePattern.test(username)) {
      return res
        .status(400)
        .json({ message: 'Username can only include letters, numbers, dot, dash, and underscore.' });
    }

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ message: 'That username is already in use.' });
    }

    const { salt, passwordHash } = hashPassword(password);
    const newUser = {
      id: `user-${Date.now()}`,
      username,
      name,
      role,
      salt,
      passwordHash,
    };

    await usersCollection().insertOne(newUser);
    res.status(201).json({ user: sanitizeUser(newUser) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/users/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    const targetUser = await findUserById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (targetUser.id === req.user.id) {
      return res
        .status(400)
        .json({ message: 'You cannot delete your own admin account while signed in.' });
    }

    const adminCount = await usersCollection().countDocuments({ role: 'admin' });
    if (targetUser.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ message: 'At least one admin account must remain.' });
    }

    await usersCollection().deleteOne({ id: targetUser.id });
    invalidateUserSessions(targetUser.id);
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/quizzes', requireAuth(), async (req, res, next) => {
  try {
    const quizzes = await readQuizzes();
    const summary = quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      questionCount: quiz.questions.length,
    }));
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/quizzes/:id', requireAuth(), async (req, res, next) => {
  try {
    const quiz = await quizzesCollection().findOne(
      { id: req.params.id },
      { projection: { _id: 0 } }
    );

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json(quiz);
  } catch (error) {
    next(error);
  }
});

app.post('/api/quizzes', requireAuth(['teacher', 'admin']), async (req, res, next) => {
  try {
    const { title, description, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Title and questions are required.' });
    }

    const validQuestions = questions.every((question) => {
      return (
        question &&
        typeof question.text === 'string' &&
        question.text.trim() &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        question.options.every((option) => typeof option === 'string' && option.trim()) &&
        Number.isInteger(question.correct) &&
        question.correct >= 0 &&
        question.correct < 4
      );
    });

    if (!validQuestions) {
      return res
        .status(400)
        .json({ message: 'Each question must include 4 options and one correct answer.' });
    }

    const newQuiz = {
      id: `quiz-${Date.now()}`,
      title: String(title).trim(),
      description: String(description || '').trim(),
      questions: questions.map((question) => ({
        text: question.text.trim(),
        options: question.options.map((option) => option.trim()),
        correct: question.correct,
      })),
      createdBy: req.user.username,
    };

    await quizzesCollection().insertOne(newQuiz);
    res.status(201).json(newQuiz);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/quizzes/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    const result = await quizzesCollection().deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/reset', requireAuth(['admin']), async (req, res, next) => {
  try {
    await quizzesCollection().deleteMany({});
    await quizzesCollection().insertMany(defaultQuizzes);
    res.json({ message: 'Quiz data reset successfully' });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

async function startServer() {
  await mongoClient.connect();
  db = mongoClient.db(MONGODB_DB);
  await ensureDatabaseState();

  app.listen(PORT, () => {
    console.log(`Quiz backend running on http://localhost:${PORT}`);
    console.log(`MongoDB connected to ${MONGODB_URI} (db: ${MONGODB_DB})`);
  });
}

startServer().catch((error) => {
  console.error('Failed to connect to MongoDB:', error);
  process.exit(1);
});

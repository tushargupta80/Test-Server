const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const quizzesPath = path.join(__dirname, 'quizzes.json');
const usersPath = path.join(__dirname, 'users.json');
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

const sessions = new Map();

app.use(
  cors({
    origin: true,
    credentials: false,
  })
);
app.use(express.json());

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

async function readJsonFile(filePath, fallbackValue) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return fallbackValue;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function ensureUsersFile() {
  try {
    await fs.access(usersPath);
  } catch (error) {
    await writeJsonFile(usersPath, defaultUsers);
  }
}

async function readUsers() {
  const users = await readJsonFile(usersPath, defaultUsers);
  return Array.isArray(users) ? users : defaultUsers;
}

async function writeUsers(users) {
  await writeJsonFile(usersPath, users);
}

async function readQuizzes() {
  const quizzes = await readJsonFile(quizzesPath, []);
  return Array.isArray(quizzes) ? quizzes : [];
}

async function writeQuizzes(quizzes) {
  await writeJsonFile(quizzesPath, quizzes);
}

function invalidateUserSessions(userId) {
  for (const [token, session] of sessions.entries()) {
    if (session.user.id === userId) {
      sessions.delete(token);
    }
  }
}

function requireAuth(allowedRoles = roles) {
  return async (req, res, next) => {
    const token = readToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const session = sessions.get(token);
    if (!session) {
      return res.status(401).json({ message: 'Session expired or invalid.' });
    }

    const users = await readUsers();
    const currentUser = users.find((entry) => entry.id === session.user.id);

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
  };
}

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const users = await readUsers();
  const user = users.find((entry) => entry.username === username);

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
});

app.get('/api/auth/me', requireAuth(), async (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', requireAuth(), async (req, res) => {
  sessions.delete(req.token);
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/users', requireAuth(['admin']), async (req, res) => {
  const users = await readUsers();
  res.json(users.map(sanitizeUser));
});

app.post('/api/users', requireAuth(['admin']), async (req, res) => {
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
    return res.status(400).json({ message: 'Username can only include letters, numbers, dot, dash, and underscore.' });
  }

  const users = await readUsers();
  const exists = users.some((entry) => entry.username.toLowerCase() === username.toLowerCase());
  if (exists) {
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

  users.push(newUser);
  await writeUsers(users);
  res.status(201).json({ user: sanitizeUser(newUser) });
});

app.delete('/api/users/:id', requireAuth(['admin']), async (req, res) => {
  const users = await readUsers();
  const targetUser = users.find((entry) => entry.id === req.params.id);

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (targetUser.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own admin account while signed in.' });
  }

  const adminCount = users.filter((entry) => entry.role === 'admin').length;
  if (targetUser.role === 'admin' && adminCount <= 1) {
    return res.status(400).json({ message: 'At least one admin account must remain.' });
  }

  const nextUsers = users.filter((entry) => entry.id !== targetUser.id);
  await writeUsers(nextUsers);
  invalidateUserSessions(targetUser.id);
  res.json({ message: 'User deleted successfully.' });
});

app.get('/api/quizzes', requireAuth(), async (req, res) => {
  const quizzes = await readQuizzes();
  const summary = quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    questionCount: quiz.questions.length,
  }));
  res.json(summary);
});

app.get('/api/quizzes/:id', requireAuth(), async (req, res) => {
  const quizzes = await readQuizzes();
  const quiz = quizzes.find((item) => item.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }
  res.json(quiz);
});

app.post('/api/quizzes', requireAuth(['teacher', 'admin']), async (req, res) => {
  const quizzes = await readQuizzes();
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

  const id = `quiz-${Date.now()}`;
  const newQuiz = {
    id,
    title: String(title).trim(),
    description: String(description || '').trim(),
    questions: questions.map((question) => ({
      text: question.text.trim(),
      options: question.options.map((option) => option.trim()),
      correct: question.correct,
    })),
    createdBy: req.user.username,
  };

  quizzes.push(newQuiz);
  await writeQuizzes(quizzes);
  res.status(201).json(newQuiz);
});

app.delete('/api/quizzes/:id', requireAuth(['admin']), async (req, res) => {
  const quizzes = await readQuizzes();
  const filtered = quizzes.filter((item) => item.id !== req.params.id);
  if (filtered.length === quizzes.length) {
    return res.status(404).json({ message: 'Quiz not found' });
  }
  await writeQuizzes(filtered);
  res.json({ message: 'Quiz deleted successfully' });
});

app.post('/api/reset', requireAuth(['admin']), async (req, res) => {
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

  await writeQuizzes(defaultQuizzes);
  res.json({ message: 'Quiz data reset successfully' });
});

ensureUsersFile()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Quiz backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize user store:', error);
    process.exit(1);
  });

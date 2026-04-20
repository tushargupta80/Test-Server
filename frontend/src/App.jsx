import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const TOKEN_STORAGE_KEY = 'quiz-platform-token';

const defaultQuestion = () => ({
  text: '',
  options: ['', '', '', ''],
  correct: 0,
});

const panelLabels = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
};

function Alert({ children, tone = 'neutral' }) {
  return <div className={`alert-box ${tone}`}>{children}</div>;
}

function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });

  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'student',
  });

  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  const [teacherQuiz, setTeacherQuiz] = useState({
    title: '',
    description: '',
    questions: [defaultQuestion()],
  });

  const currentPanel = currentUser?.role || null;

  const fetchApi = async (path, options = {}, tokenOverride) => {
    const token = tokenOverride ?? authToken;
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const apiError = new Error(body.message || 'API request failed');
      apiError.status = response.status;
      throw apiError;
    }

    return response.json();
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken('');
    setCurrentUser(null);
    setQuizzes([]);
    setUsers([]);
    setSelectedQuiz(null);
    setAnswers([]);
    setResult(null);
  };

  const refreshQuizzes = async (tokenOverride) => {
    const list = await fetchApi('/quizzes', {}, tokenOverride);
    setQuizzes(list);
  };

  const refreshUsers = async (tokenOverride) => {
    const list = await fetchApi('/users', {}, tokenOverride);
    setUsers(list);
  };

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      setQuizzes([]);
      setUsers([]);
      return;
    }

    let cancelled = false;

    const bootstrapSession = async () => {
      setLoading(true);
      setError('');
      setMessage('');

      try {
        const { user } = await fetchApi('/auth/me', {}, authToken);
        const requests = [fetchApi('/quizzes', {}, authToken)];

        if (user.role === 'admin') {
          requests.push(fetchApi('/users', {}, authToken));
        }

        const results = await Promise.all(requests);

        if (cancelled) {
          return;
        }

        setCurrentUser(user);
        setQuizzes(results[0]);
        setUsers(user.role === 'admin' ? results[1] : []);
      } catch (err) {
        if (cancelled) {
          return;
        }

        clearSession();
        setError(err.message || 'Unable to restore your session.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await fetchApi(
        '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginForm),
        },
        ''
      );

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setLoginForm({ username: '', password: '' });
      setMessage(`Signed in as ${data.user.name} (${panelLabels[data.user.role]}).`);
      await refreshQuizzes(data.token);

      if (data.user.role === 'admin') {
        await refreshUsers(data.token);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (authToken) {
        await fetchApi('/auth/logout', { method: 'POST' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      clearSession();
      setLoading(false);
      setMessage('You have been logged out.');
    }
  };

  const openQuiz = async (quizId) => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const quiz = await fetchApi(`/quizzes/${quizId}`);
      setSelectedQuiz(quiz);
      setQuestionIndex(0);
      setAnswers(new Array(quiz.questions.length).fill(null));
      setResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateAnswer = (optionIndex) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  const submitAttempt = () => {
    if (!selectedQuiz) {
      return;
    }

    if (answers.includes(null) && !window.confirm('Some questions are unanswered. Submit anyway?')) {
      return;
    }

    const score = answers.reduce((sum, answer, idx) => {
      return sum + (answer === selectedQuiz.questions[idx].correct ? 1 : 0);
    }, 0);

    setResult({ score, total: selectedQuiz.questions.length });
  };

  const addQuestion = () => {
    setTeacherQuiz((prev) => ({
      ...prev,
      questions: [...prev.questions, defaultQuestion()],
    }));
  };

  const updateQuestion = (index, field, value) => {
    setTeacherQuiz((prev) => {
      const questions = [...prev.questions];
      questions[index] = { ...questions[index], [field]: value };
      return { ...prev, questions };
    });
  };

  const updateOption = (questionIdx, optionIndex, value) => {
    setTeacherQuiz((prev) => {
      const questions = [...prev.questions];
      const options = [...questions[questionIdx].options];
      options[optionIndex] = value;
      questions[questionIdx] = { ...questions[questionIdx], options };
      return { ...prev, questions };
    });
  };

  const removeQuestion = (index) => {
    setTeacherQuiz((prev) => {
      const questions = prev.questions.filter((_, idx) => idx !== index);
      return { ...prev, questions: questions.length ? questions : [defaultQuestion()] };
    });
  };

  const handleTeacherSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!teacherQuiz.title.trim() || teacherQuiz.questions.length === 0) {
      setError('Quiz title and at least one question are required.');
      return;
    }

    const invalid = teacherQuiz.questions.some((question) => {
      return (
        !question.text.trim() ||
        question.options.some((option) => !option.trim()) ||
        question.options.length !== 4
      );
    });

    if (invalid) {
      setError('Each question must include text and four answer options.');
      return;
    }

    setLoading(true);

    try {
      await fetchApi('/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teacherQuiz),
      });

      setTeacherQuiz({
        title: '',
        description: '',
        questions: [defaultQuestion()],
      });

      await refreshQuizzes();
      setMessage('Quiz saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await fetchApi('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      setUserForm({
        name: '',
        username: '',
        password: '',
        role: 'student',
      });

      await refreshUsers();
      setMessage('User account created successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (quizId) => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await fetchApi(`/quizzes/${quizId}`, { method: 'DELETE' });
      await refreshQuizzes();
      setMessage('Quiz deleted successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete the account for ${userName}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await fetchApi(`/users/${userId}`, { method: 'DELETE' });
      await refreshUsers();
      setMessage('User deleted successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetData = async () => {
    if (!window.confirm('Reset all quiz data to the defaults?')) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await fetchApi('/reset', { method: 'POST' });
      await refreshQuizzes();
      setMessage('Platform data has been reset.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quizSummary = useMemo(() => {
    const count = quizzes.length;
    const questions = quizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0);
    return { count, questions };
  }, [quizzes]);

  const userSummary = useMemo(() => {
    return {
      total: users.length,
      students: users.filter((user) => user.role === 'student').length,
      teachers: users.filter((user) => user.role === 'teacher').length,
      admins: users.filter((user) => user.role === 'admin').length,
    };
  }, [users]);

  if (!currentUser) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand">
            <h1>Quiz Platform</h1>
            <p>Sign in to continue to your role-specific dashboard.</p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}
          {loading && <Alert>Loading...</Alert>}

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-row">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, username: event.target.value }))
                }
                autoComplete="username"
              />
            </div>

            <div className="form-row">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="primary full-width">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header>
        <div className="brand">
          <h1>Quiz Platform</h1>
          <p>Authenticated access for students, teachers, and admins.</p>
        </div>

        <div className="header-actions">
          <div className="user-pill">
            <strong>{currentUser.name}</strong>
            <span>
              {panelLabels[currentUser.role]} | {currentUser.username}
            </span>
          </div>
          <button type="button" className="secondary" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <div className="role-banner">
        <span className="role-tag">{panelLabels[currentPanel]}</span>
        <p>You are signed in with {panelLabels[currentPanel].toLowerCase()} access.</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      {loading && <Alert>Loading...</Alert>}

      <main>
        {currentPanel === 'student' && (
          <section className="panel active">
            <div className="panel-header">
              <div>
                <h2>Student Dashboard</h2>
                <p>Select a quiz card to begin attempting.</p>
              </div>
            </div>

            <div className="card-grid">
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  type="button"
                  className="quiz-card"
                  onClick={() => openQuiz(quiz.id)}
                >
                  <h3>{quiz.title}</h3>
                  <p>{quiz.description}</p>
                  <small>{quiz.questionCount} question(s)</small>
                </button>
              ))}
            </div>

            {selectedQuiz && (
              <div className="attempt-panel">
                <div className="attempt-header">
                  <div>
                    <h3>{selectedQuiz.title}</h3>
                    <p className="muted">{selectedQuiz.description}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedQuiz(null)}>
                    Close
                  </button>
                </div>

                <div className="question-card">
                  <h4>
                    Question {questionIndex + 1} of {selectedQuiz.questions.length}
                  </h4>
                  <p>{selectedQuiz.questions[questionIndex].text}</p>
                  <div className="options-list">
                    {selectedQuiz.questions[questionIndex].options.map((option, idx) => (
                      <label key={idx} className="option-row">
                        <input
                          type="radio"
                          name="quiz-option"
                          checked={answers[questionIndex] === idx}
                          onChange={() => updateAnswer(idx)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="attempt-footer">
                  <button
                    type="button"
                    className="secondary"
                    disabled={questionIndex === 0}
                    onClick={() => setQuestionIndex((idx) => Math.max(0, idx - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={questionIndex === selectedQuiz.questions.length - 1}
                    onClick={() =>
                      setQuestionIndex((idx) =>
                        Math.min(selectedQuiz.questions.length - 1, idx + 1)
                      )
                    }
                  >
                    Next
                  </button>
                  <button type="button" className="primary" onClick={submitAttempt}>
                    Submit Quiz
                  </button>
                </div>

                {result && (
                  <div className="result-box">
                    <strong>
                      Score: {result.score} / {result.total}
                    </strong>
                    <p>
                      {result.score === result.total
                        ? 'Perfect score! Well done.'
                        : 'Nice work. Review your answers if you want to improve.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {currentPanel === 'teacher' && (
          <section className="panel active">
            <div className="panel-header">
              <div>
                <h2>Teacher Dashboard</h2>
                <p>Add a quiz with questions and correct answers.</p>
              </div>
            </div>

            <form className="teacher-form" onSubmit={handleTeacherSubmit}>
              <div className="form-row">
                <label htmlFor="quizTitle">Quiz title</label>
                <input
                  id="quizTitle"
                  value={teacherQuiz.title}
                  onChange={(event) =>
                    setTeacherQuiz((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="quizDescription">Quiz description</label>
                <textarea
                  id="quizDescription"
                  rows="3"
                  value={teacherQuiz.description}
                  onChange={(event) =>
                    setTeacherQuiz((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </div>

              <div className="questions-container">
                {teacherQuiz.questions.map((question, idx) => (
                  <div key={idx} className="question-item">
                    <div className="question-item-header">
                      <h4>Question {idx + 1}</h4>
                      <button
                        type="button"
                        className="danger small"
                        onClick={() => removeQuestion(idx)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="form-row">
                      <label>Question text</label>
                      <textarea
                        value={question.text}
                        onChange={(event) => updateQuestion(idx, 'text', event.target.value)}
                      />
                    </div>
                    <div className="question-row">
                      {question.options.map((option, optionIdx) => (
                        <div key={optionIdx} className="form-row">
                          <label>Option {String.fromCharCode(65 + optionIdx)}</label>
                          <input
                            value={option}
                            onChange={(event) =>
                              updateOption(idx, optionIdx, event.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="form-row">
                      <label>Correct answer</label>
                      <select
                        value={question.correct}
                        onChange={(event) =>
                          updateQuestion(idx, 'correct', Number(event.target.value))
                        }
                      >
                        {[0, 1, 2, 3].map((optionValue) => (
                          <option key={optionValue} value={optionValue}>
                            {String.fromCharCode(65 + optionValue)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="teacher-actions">
                <button type="button" className="secondary" onClick={addQuestion}>
                  Add Question
                </button>
                <button type="submit" className="primary">
                  Save Quiz
                </button>
              </div>
            </form>
          </section>
        )}

        {currentPanel === 'admin' && (
          <section className="panel active">
            <div className="panel-header">
              <div>
                <h2>Admin Dashboard</h2>
                <p>Manage quizzes, reset data, and create platform accounts.</p>
              </div>
            </div>

            <div className="admin-cards">
              <div className="admin-card">
                <h3>{quizSummary.count}</h3>
                <p>Total quizzes</p>
              </div>
              <div className="admin-card">
                <h3>{quizSummary.questions}</h3>
                <p>Total questions</p>
              </div>
              <div className="admin-card">
                <h3>{userSummary.total}</h3>
                <p>Total users</p>
              </div>
              <div className="admin-card">
                <h3>{userSummary.admins}</h3>
                <p>Admin accounts</p>
              </div>
            </div>

            <div className="admin-layout">
              <form className="teacher-form" onSubmit={handleUserSubmit}>
                <div className="section-heading">
                  <h3>Create User</h3>
                  <p className="muted">New accounts are stored persistently in the backend.</p>
                </div>

                <div className="form-row">
                  <label htmlFor="userName">Full name</label>
                  <input
                    id="userName"
                    value={userForm.name}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </div>

                <div className="question-row">
                  <div className="form-row">
                    <label htmlFor="newUsername">Username</label>
                    <input
                      id="newUsername"
                      value={userForm.username}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, username: event.target.value }))
                      }
                    />
                  </div>

                  <div className="form-row">
                    <label htmlFor="newPassword">Password</label>
                    <input
                      id="newPassword"
                      type="password"
                      value={userForm.password}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label htmlFor="newRole">Role</label>
                  <select
                    id="newRole"
                    value={userForm.role}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, role: event.target.value }))
                    }
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button type="submit" className="primary">
                  Create Account
                </button>
              </form>

              <div className="admin-user-panel">
                <div className="section-heading">
                  <h3>User Accounts</h3>
                  <p className="muted">
                    Students: {userSummary.students} | Teachers: {userSummary.teachers} | Admins:{' '}
                    {userSummary.admins}
                  </p>
                </div>

                {users.length === 0 ? (
                  <p className="muted">No users found.</p>
                ) : (
                  <div className="admin-list">
                    {users.map((user) => (
                      <div key={user.id} className="admin-quiz-item">
                        <div>
                          <strong>{user.name}</strong>
                          <div className="muted">
                            {user.username} | {panelLabels[user.role]}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="danger"
                          disabled={user.id === currentUser.id}
                          onClick={() => deleteUser(user.id, user.name)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-list">
              <h3>Available Quizzes</h3>
              {quizzes.length === 0 ? (
                <p className="muted">No quizzes available yet.</p>
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz.id} className="admin-quiz-item">
                    <div>
                      <strong>{quiz.title}</strong>
                      <div className="muted">{quiz.questionCount} questions</div>
                    </div>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => deleteQuiz(quiz.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>

            <button type="button" className="danger" onClick={resetData}>
              Reset platform data
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

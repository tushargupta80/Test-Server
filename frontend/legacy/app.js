const studentPanelBtn = document.getElementById('studentPanelBtn');
const teacherPanelBtn = document.getElementById('teacherPanelBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const studentPanel = document.getElementById('studentPanel');
const teacherPanel = document.getElementById('teacherPanel');
const adminPanel = document.getElementById('adminPanel');
const quizList = document.getElementById('quizList');
const quizAttempt = document.getElementById('quizAttempt');
const attemptQuizTitle = document.getElementById('attemptQuizTitle');
const questionContainer = document.getElementById('questionContainer');
const prevQuestion = document.getElementById('prevQuestion');
const nextQuestion = document.getElementById('nextQuestion');
const submitQuiz = document.getElementById('submitQuiz');
const closeAttempt = document.getElementById('closeAttempt');
const resultBox = document.getElementById('resultBox');
const teacherForm = document.getElementById('teacherForm');
const quizTitleInput = document.getElementById('quizTitle');
const quizDescriptionInput = document.getElementById('quizDescription');
const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const adminQuizList = document.getElementById('adminQuizList');
const totalQuizzes = document.getElementById('totalQuizzes');
const totalQuestions = document.getElementById('totalQuestions');
const resetData = document.getElementById('resetData');
const panelButtons = [studentPanelBtn, teacherPanelBtn, adminPanelBtn];
const panels = [studentPanel, teacherPanel, adminPanel];

let quizzes = [];
let activeQuiz = null;
let currentQuestionIndex = 0;
let answers = [];

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

function loadQuizzes() {
  const saved = localStorage.getItem('quizPlatformData');
  if (saved) {
    try {
      quizzes = JSON.parse(saved);
    } catch (error) {
      quizzes = defaultQuizzes;
    }
  } else {
    quizzes = defaultQuizzes;
    saveQuizzes();
  }
}

function saveQuizzes() {
  localStorage.setItem('quizPlatformData', JSON.stringify(quizzes));
}

function switchPanel(index) {
  panelButtons.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === index);
  });
  panels.forEach((panel, idx) => {
    panel.classList.toggle('active', idx === index);
  });
}

function renderQuizCards() {
  quizList.innerHTML = '';
  quizzes.forEach((quiz) => {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.innerHTML = `
      <h3>${quiz.title}</h3>
      <p>${quiz.description}</p>
      <small>${quiz.questions.length} question(s)</small>`;
    card.addEventListener('click', () => openQuizAttempt(quiz.id));
    quizList.appendChild(card);
  });
}

function renderAdminInfo() {
  totalQuizzes.textContent = quizzes.length;
  const questionCount = quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
  totalQuestions.textContent = questionCount;

  adminQuizList.innerHTML = '';
  if (quizzes.length === 0) {
    adminQuizList.textContent = 'No quizzes available.';
    return;
  }
  quizzes.forEach((quiz) => {
    const item = document.createElement('div');
    item.className = 'admin-quiz-item';
    item.innerHTML = `
      <div>
        <strong>${quiz.title}</strong>
        <div style="color: var(--muted); margin-top: 4px;">${quiz.questions.length} questions</div>
      </div>
      <button class="danger">Delete</button>`;
    item.querySelector('button').addEventListener('click', () => {
      quizzes = quizzes.filter((q) => q.id !== quiz.id);
      saveQuizzes();
      renderQuizCards();
      renderAdminInfo();
    });
    adminQuizList.appendChild(item);
  });
}

function openQuizAttempt(id) {
  activeQuiz = quizzes.find((quiz) => quiz.id === id);
  if (!activeQuiz) return;
  attemptQuizTitle.textContent = activeQuiz.title;
  answers = new Array(activeQuiz.questions.length).fill(null);
  currentQuestionIndex = 0;
  resultBox.classList.add('hidden');
  renderQuestion();
  quizAttempt.classList.remove('hidden');
}

function renderQuestion() {
  const question = activeQuiz.questions[currentQuestionIndex];
  questionContainer.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'question-item';
  card.innerHTML = `
    <h4>Question ${currentQuestionIndex + 1} of ${activeQuiz.questions.length}</h4>
    <p style="margin-bottom: 14px;">${question.text}</p>
  `;

  question.options.forEach((option, optionIndex) => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginBottom = '10px';
    label.innerHTML = `
      <input type="radio" name="question-option" value="${optionIndex}" ${answers[currentQuestionIndex] === optionIndex ? 'checked' : ''} />
      <span style="margin-left: 10px;">${option}</span>`;
    label.querySelector('input').addEventListener('change', () => {
      answers[currentQuestionIndex] = optionIndex;
    });
    card.appendChild(label);
  });

  questionContainer.appendChild(card);
  prevQuestion.disabled = currentQuestionIndex === 0;
  nextQuestion.disabled = currentQuestionIndex === activeQuiz.questions.length - 1;
}

function showResult() {
  const score = answers.reduce((sum, answer, idx) => {
    if (answer === activeQuiz.questions[idx].correct) return sum + 1;
    return sum;
  }, 0);
  resultBox.innerHTML = `
    <strong>Score: ${score} / ${activeQuiz.questions.length}</strong>
    <p>${score === activeQuiz.questions.length ? 'Excellent work!' : 'Review the quiz and try again.'}</p>
  `;
  resultBox.classList.remove('hidden');
}

function resetTeacherForm() {
  quizTitleInput.value = '';
  quizDescriptionInput.value = '';
  questionsContainer.innerHTML = '';
  addQuestionBlock();
}

function addQuestionBlock() {
  const questionIndex = questionsContainer.children.length + 1;
  const block = document.createElement('div');
  block.className = 'question-item';
  block.innerHTML = `
    <h4>Question ${questionIndex}</h4>
    <div class="form-row">
      <label>Question text</label>
      <textarea class="question-text" rows="2" placeholder="Enter the question"></textarea>
    </div>
    <div class="question-row">
      <div class="form-row">
        <label>Option A</label>
        <input class="option-input" type="text" placeholder="Option A" />
      </div>
      <div class="form-row">
        <label>Option B</label>
        <input class="option-input" type="text" placeholder="Option B" />
      </div>
      <div class="form-row">
        <label>Option C</label>
        <input class="option-input" type="text" placeholder="Option C" />
      </div>
      <div class="form-row">
        <label>Option D</label>
        <input class="option-input" type="text" placeholder="Option D" />
      </div>
    </div>
    <div class="form-row">
      <label>Correct option</label>
      <select class="correct-option">
        <option value="0">A</option>
        <option value="1">B</option>
        <option value="2">C</option>
        <option value="3">D</option>
      </select>
    </div>
    <button type="button" class="danger remove-question">Remove question</button>
  `;

  block.querySelector('.remove-question').addEventListener('click', () => {
    block.remove();
    Array.from(questionsContainer.children).forEach((child, idx) => {
      const heading = child.querySelector('h4');
      if (heading) heading.textContent = `Question ${idx + 1}`;
    });
  });

  questionsContainer.appendChild(block);
}

function collectTeacherQuestions() {
  const questionBlocks = Array.from(questionsContainer.children);
  return questionBlocks.map((block) => {
    const text = block.querySelector('.question-text').value.trim();
    const options = Array.from(block.querySelectorAll('.option-input')).map((input) => input.value.trim());
    const correct = parseInt(block.querySelector('.correct-option').value, 10);
    return {
      text,
      options,
      correct,
    };
  });
}

function initialize() {
  loadQuizzes();
  renderQuizCards();
  renderAdminInfo();
  addQuestionBlock();
}

studentPanelBtn.addEventListener('click', () => switchPanel(0));
teacherPanelBtn.addEventListener('click', () => switchPanel(1));
adminPanelBtn.addEventListener('click', () => switchPanel(2));

prevQuestion.addEventListener('click', () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex -= 1;
    renderQuestion();
  }
});

nextQuestion.addEventListener('click', () => {
  if (currentQuestionIndex < activeQuiz.questions.length - 1) {
    currentQuestionIndex += 1;
    renderQuestion();
  }
});

submitQuiz.addEventListener('click', () => {
  if (!activeQuiz) return;
  if (answers.includes(null)) {
    if (!confirm('You have unanswered questions. Submit anyway?')) return;
  }
  showResult();
});

closeAttempt.addEventListener('click', () => {
  quizAttempt.classList.add('hidden');
  activeQuiz = null;
});

addQuestionBtn.addEventListener('click', addQuestionBlock);

teacherForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = quizTitleInput.value.trim();
  const description = quizDescriptionInput.value.trim();
  const questions = collectTeacherQuestions();

  if (!title || questions.length === 0) {
    alert('Please provide a title and at least one question.');
    return;
  }

  const invalid = questions.some((question) => {
    return (
      !question.text ||
      question.options.some((option) => option === '') ||
      question.options.length !== 4
    );
  });

  if (invalid) {
    alert('Every question must have text and four answer options.');
    return;
  }

  const newQuiz = {
    id: `quiz-${Date.now()}`,
    title,
    description,
    questions,
  };

  quizzes.push(newQuiz);
  saveQuizzes();
  renderQuizCards();
  renderAdminInfo();
  resetTeacherForm();
  alert('Quiz added successfully.');
});

resetData.addEventListener('click', () => {
  if (!confirm('Reset all quiz data and restore sample quizzes?')) return;
  quizzes = [...defaultQuizzes];
  saveQuizzes();
  renderQuizCards();
  renderAdminInfo();
  alert('Platform data has been reset.');
});

initialize();

const apiBase = 'http://localhost:4000/api';
const studentPanelBtn = document.getElementById('studentPanelBtn');
const teacherPanelBtn = document.getElementById('teacherPanelBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const studentPanel = document.getElementById('studentPanel');
const teacherPanel = document.getElementById('teacherPanel');
const adminPanel = document.getElementById('adminPanel');
const quizList = document.getElementById('quizList');
const quizAttempt = document.getElementById('quizAttempt');
const attemptQuizTitle = document.getElementById('attemptQuizTitle');
const attemptQuizDescription = document.getElementById('attemptQuizDescription');
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

let activeQuiz = null;
let currentQuestionIndex = 0;
let answers = [];

function switchPanel(index) {
  panelButtons.forEach((btn, idx) => btn.classList.toggle('active', idx === index));
  panels.forEach((panel, idx) => panel.classList.toggle('active', idx === index));
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'API request failed');
  }
  return response.json();
}

async function loadQuizzes() {
  const quizzes = await apiFetch('/quizzes');
  quizList.innerHTML = '';
  quizzes.forEach((quiz) => {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.innerHTML = `
      <h3>${quiz.title}</h3>
      <p>${quiz.description}</p>
      <small>${quiz.questionCount} question(s)</small>`;
    card.addEventListener('click', () => openQuizAttempt(quiz.id));
    quizList.appendChild(card);
  });
}

async function renderAdminInfo() {
  const quizzes = await apiFetch('/quizzes');
  totalQuizzes.textContent = quizzes.length;
  totalQuestions.textContent = quizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0);
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
        <div style="color: var(--muted); margin-top: 4px;">${quiz.questionCount} questions</div>
      </div>
      <button class="danger">Delete</button>`;
    item.querySelector('button').addEventListener('click', async () => {
      await apiFetch(`/quizzes/${quiz.id}`, { method: 'DELETE' });
      await refreshAll();
    });
    adminQuizList.appendChild(item);
  });
}

async function openQuizAttempt(id) {
  activeQuiz = await apiFetch(`/quizzes/${id}`);
  attemptQuizTitle.textContent = activeQuiz.title;
  attemptQuizDescription.textContent = activeQuiz.description;
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
    <p style="margin-bottom: 14px;">${question.text}</p>`;

  question.options.forEach((option, optionIndex) => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginBottom = '10px';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'question-option';
    radio.value = optionIndex;
    radio.checked = answers[currentQuestionIndex] === optionIndex;
    radio.addEventListener('change', () => {
      answers[currentQuestionIndex] = optionIndex;
    });
    label.appendChild(radio);
    const textSpan = document.createElement('span');
    textSpan.style.marginLeft = '10px';
    textSpan.textContent = option;
    label.appendChild(textSpan);
    card.appendChild(label);
  });

  questionContainer.appendChild(card);
  prevQuestion.disabled = currentQuestionIndex === 0;
  nextQuestion.disabled = currentQuestionIndex === activeQuiz.questions.length - 1;
}

function showResult() {
  const score = answers.reduce((sum, answer, idx) => {
    return sum + (answer === activeQuiz.questions[idx].correct ? 1 : 0);
  }, 0);
  resultBox.innerHTML = `
    <strong>Score: ${score} / ${activeQuiz.questions.length}</strong>
    <p>${score === activeQuiz.questions.length ? 'Excellent work!' : 'Review the quiz and try again.'}</p>`;
  resultBox.classList.remove('hidden');
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
    <button type="button" class="danger remove-question">Remove question</button>`;

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
  return Array.from(questionsContainer.children).map((block) => {
    const text = block.querySelector('.question-text').value.trim();
    const options = Array.from(block.querySelectorAll('.option-input')).map((input) => input.value.trim());
    const correct = parseInt(block.querySelector('.correct-option').value, 10);
    return { text, options, correct };
  });
}

function resetTeacherForm() {
  quizTitleInput.value = '';
  quizDescriptionInput.value = '';
  questionsContainer.innerHTML = '';
  addQuestionBlock();
}

async function refreshAll() {
  await loadQuizzes();
  await renderAdminInfo();
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
  if (answers.includes(null) && !confirm('You have unanswered questions. Submit anyway?')) return;
  showResult();
});
closeAttempt.addEventListener('click', () => {
  quizAttempt.classList.add('hidden');
  activeQuiz = null;
});
addQuestionBtn.addEventListener('click', addQuestionBlock);
teacherForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = quizTitleInput.value.trim();
  const description = quizDescriptionInput.value.trim();
  const questions = collectTeacherQuestions();

  if (!title || questions.length === 0) {
    alert('Please provide a title and at least one question.');
    return;
  }

  const invalid = questions.some((question) => {
    return (!question.text || question.options.some((option) => option === '') || question.options.length !== 4);
  });

  if (invalid) {
    alert('Every question must have text and four answer options.');
    return;
  }

  await apiFetch('/quizzes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, questions }),
  });

  await refreshAll();
  resetTeacherForm();
  alert('Quiz added successfully.');
});
resetData.addEventListener('click', async () => {
  if (!confirm('Reset all quiz data and restore sample quizzes?')) return;
  await apiFetch('/reset', { method: 'POST' });
  await refreshAll();
  alert('Platform data has been reset.');
});

(async function init() {
  await refreshAll();
  addQuestionBlock();
})();

import { QuizSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';

export function renderQuiz(spec: QuizSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-quiz-card' });
  const questions = spec.questions || [];

  let currentIndex = 0;
  const answers = new Map<number, number>();
  let isCompleted = false;

  function calculateScore(): number {
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answers.get(i) === questions[i].answer) {
        score++;
      }
    }
    return score;
  }

  function render(): void {
    clear(card);

    if (questions.length === 0) {
      if (spec.title) {
        card.appendChild(h('div', { class: 'iui-title iui-quiz-title' }, spec.title));
      }
      card.appendChild(h('div', { class: 'iui-quiz-empty' }, 'No quiz questions available.'));
      return;
    }

    // Header row: Title on left, "1 of N" and prev/next chevrons on right
    const header = h('div', { class: 'iui-quiz-header' });
    const titleText = spec.title || '';
    const titleEl = titleText
      ? h('div', { class: 'iui-title iui-quiz-title' }, titleText)
      : h('div', { class: 'iui-quiz-title-spacer' });
    header.appendChild(titleEl);

    const headerRight = h('div', { class: 'iui-quiz-header-right' });

    if (!isCompleted) {
      const counter = h(
        'span',
        { class: 'iui-quiz-counter', 'aria-live': 'polite' },
        `${currentIndex + 1} of ${questions.length}`,
      );
      headerRight.appendChild(counter);

      const navGroup = h('div', { class: 'iui-quiz-nav', role: 'group', 'aria-label': 'Quiz navigation' });

      const prevBtn = h(
        'button',
        {
          type: 'button',
          class: 'iui-quiz-nav-btn',
          'aria-label': 'Previous question',
          title: 'Previous question',
          disabled: currentIndex === 0,
          onClick: () => {
            if (currentIndex > 0) {
              currentIndex--;
              render();
            }
          },
        },
        iconEl('chevron-left', 14),
      ) as HTMLButtonElement;

      const nextBtn = h(
        'button',
        {
          type: 'button',
          class: 'iui-quiz-nav-btn',
          'aria-label': 'Next question',
          title: 'Next question',
          disabled: currentIndex >= questions.length - 1,
          onClick: () => {
            if (currentIndex < questions.length - 1) {
              currentIndex++;
              render();
            }
          },
        },
        iconEl('chevron-right', 14),
      ) as HTMLButtonElement;

      navGroup.appendChild(prevBtn);
      navGroup.appendChild(nextBtn);
      headerRight.appendChild(navGroup);
    } else {
      const endCounter = h(
        'span',
        { class: 'iui-quiz-counter' },
        `Completed`,
      );
      headerRight.appendChild(endCounter);
    }

    header.appendChild(headerRight);
    card.appendChild(header);

    // Body: Result view or Current Question
    if (isCompleted) {
      const score = calculateScore();
      const resultsWrap = h('div', { class: 'iui-quiz-results' });
      const scoreText = h(
        'div',
        { class: 'iui-quiz-score-text' },
        `You scored ${score} of ${questions.length}`,
      );

      const retryBtn = h(
        'button',
        {
          type: 'button',
          class: 'iui-btn-ghost iui-quiz-retry-btn',
          onClick: () => {
            answers.clear();
            currentIndex = 0;
            isCompleted = false;
            render();
          },
        },
        'Retry',
      );

      resultsWrap.appendChild(scoreText);
      resultsWrap.appendChild(retryBtn);
      card.appendChild(resultsWrap);
      return;
    }

    const currentQ = questions[currentIndex];
    const qContainer = h('div', { class: 'iui-quiz-q-container' });

    // Question text
    const qText = h('div', { class: 'iui-quiz-q-text' }, currentQ.q);
    qContainer.appendChild(qText);

    // Options: compact rows (36px) with letter in small outlined circle
    const optionsContainer = h('div', { class: 'iui-quiz-options' });
    const selectedAnswer = answers.get(currentIndex);
    const hasAnswered = selectedAnswer !== undefined;

    const opts = currentQ.options || [];
    for (let optIdx = 0; optIdx < opts.length; optIdx++) {
      const optText = opts[optIdx];
      const letter = String.fromCharCode(65 + optIdx);

      const isPicked = selectedAnswer === optIdx;
      const isCorrectOption = optIdx === currentQ.answer;

      const btnClasses = ['iui-quiz-opt-row'];
      if (hasAnswered) {
        if (isCorrectOption) {
          btnClasses.push('is-correct');
        } else if (isPicked) {
          btnClasses.push('is-incorrect');
        }
      }

      const letterCircle = h('span', { class: 'iui-quiz-letter-circle' }, letter);
      const textSpan = h('span', { class: 'iui-quiz-opt-text' }, optText);

      const optBtn = h(
        'button',
        {
          type: 'button',
          class: btnClasses.join(' '),
          disabled: hasAnswered,
          onClick: () => {
            if (hasAnswered) return;
            answers.set(currentIndex, optIdx);

            // Re-render to show correct/incorrect and explanation
            render();

            // If this was the last question or all are answered, check if we should auto-finish or show results
            if (answers.size === questions.length) {
              setTimeout(() => {
                if (!card.isConnected) return;
                // Wait briefly so user sees the explanation, then offer results
                const finishNotice = card.querySelector('.iui-quiz-finish-prompt');
                if (!finishNotice) {
                  const finishBar = h(
                    'div',
                    { class: 'iui-quiz-finish-bar' },
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'iui-btn-ghost iui-quiz-finish-btn',
                        onClick: () => {
                          isCompleted = true;
                          render();
                        },
                      },
                      'View final score \u2192',
                    ),
                  );
                  card.appendChild(finishBar);
                }
              }, 400);
            }
          },
        },
        letterCircle,
        textSpan,
      );

      optionsContainer.appendChild(optBtn);
    }
    qContainer.appendChild(optionsContainer);

    // One-line explanation after an answer
    if (hasAnswered && currentQ.explain) {
      const explainEl = h(
        'div',
        { class: 'iui-quiz-explain' },
        h('span', { class: 'iui-quiz-explain-icon' }, iconEl('info', 14)),
        h('span', { class: 'iui-quiz-explain-text' }, currentQ.explain),
      );
      qContainer.appendChild(explainEl);
    }

    card.appendChild(qContainer);
  }

  render();
  return card;
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

function Quiz({ quiz, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);

  const submit = async () => {
    if (selected === null) return;
    const res = await api.post(`/lessons/quizzes/${quiz.id}/attempt`, { selected_index: selected });
    setResult(res.data);
    onAnswer(res.data.is_correct);
  };

  return (
    <div className="quiz-block">
      <div className="quiz-question">❓ {quiz.question}</div>
      <div className="quiz-options">
        {quiz.options.map((opt, i) => {
          let cls = 'quiz-option';
          if (result !== null) {
            cls += ' disabled';
            if (i === result.correct_index) cls += ' correct';
            else if (i === selected && !result.is_correct) cls += ' wrong';
          } else if (selected === i) {
            cls += ' selected';
          }
          return (
            <div key={i} className={cls} onClick={() => result === null && setSelected(i)}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </div>
          );
        })}
      </div>
      {result === null ? (
        <button className="btn btn-primary btn-sm mt-2" onClick={submit} disabled={selected === null}>Submit Answer</button>
      ) : (
        <div className={`alert ${result.is_correct ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 12 }}>
          {result.is_correct ? '✅ Correct!' : '❌ Incorrect. The correct answer is highlighted above.'}
        </div>
      )}
    </div>
  );
}

export default function LessonView() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get(`/lessons/${id}`)
      .then(r => { setLesson(r.data); setLoading(false); })
      .catch(() => navigate(-1));
  }, [id]);

  const markComplete = async () => {
    setCompleting(true);
    try {
      const res = await api.post(`/lessons/${id}/complete`);
      setLesson(l => ({ ...l, progress: { completed: 1 } }));
      setMsg(res.data.course_completed ? '🏆 Course complete! Congratulations!' : '✅ Lesson marked as complete!');
    } catch (err) { setMsg(err.response?.data?.error || 'Error'); }
    finally { setCompleting(false); }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!lesson) return null;

  const isCompleted = lesson.progress?.completed === 1;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back to Course</button>
          {isCompleted && <span className="badge badge-success">✓ Completed</span>}
        </div>
        <h1>{lesson.title}</h1>
        {lesson.duration > 0 && <p>⏱ {lesson.duration} min read</p>}
      </div>

      <div className="page-body">
        {msg && <div className={`alert ${msg.includes('🏆') || msg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{msg}</div>}

        <div className="lesson-page">
          <div className="lesson-content-area">
            {lesson.video_url && (
              <div className="card card-body">
                <h3 style={{ marginBottom: 12 }}>Video Lesson</h3>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 8, overflow: 'hidden' }}>
                  <iframe src={lesson.video_url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} allowFullScreen title={lesson.title} />
                </div>
              </div>
            )}

            <div className="card card-body">
              <h3 style={{ marginBottom: 16 }}>Lesson Content</h3>
              <div style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{lesson.content}</div>
            </div>

            {lesson.quizzes?.length > 0 && (
              <div className="card card-body">
                <h3 style={{ marginBottom: 16 }}>📝 Knowledge Check ({lesson.quizzes.length} questions)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {lesson.quizzes.map(q => <Quiz key={q.id} quiz={q} onAnswer={() => {}} />)}
                </div>
              </div>
            )}
          </div>

          <div className="lesson-sidebar-panel">
            <div className="card card-body">
              {user?.role === 'student' && (
                isCompleted ? (
                  <div className="alert alert-success">✓ You've completed this lesson!</div>
                ) : (
                  <button className="btn btn-success w-full" onClick={markComplete} disabled={completing}>
                    {completing ? 'Saving…' : '✓ Mark as Complete'}
                  </button>
                )
              )}
              {(user?.role === 'teacher' || user?.role === 'admin') && lesson.teacher_id === user?.id && (
                <Link to={`/courses/${lesson.course_id}/manage`} className="btn btn-secondary w-full">← Back to Course Manager</Link>
              )}
              <hr style={{ margin: '16px 0', borderColor: 'var(--border)' }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lesson.duration > 0 && <span>⏱ {lesson.duration} min</span>}
                {lesson.quizzes?.length > 0 && <span>❓ {lesson.quizzes.length} quiz question{lesson.quizzes.length > 1 ? 's' : ''}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

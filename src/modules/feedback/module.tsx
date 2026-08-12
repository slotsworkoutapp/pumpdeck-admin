import type { AdminModule } from '../types';
import FeedbackList from './FeedbackList';

export const feedbackModule: AdminModule = {
  id: 'feedback',
  label: 'Feedback',
  icon: <ChatIcon />,
  routes: [{ element: <FeedbackList /> }],
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-4.5A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

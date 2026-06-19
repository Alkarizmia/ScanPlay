interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="app-toast" role="status">
      {message}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (code.trim().length !== 6) { setError('Room code must be 6 characters'); return; }

    sessionStorage.setItem('participant_info', JSON.stringify({ firstName, lastName, nickname }));
    navigate(`/session/${code.toUpperCase()}`);
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-3xl justify-center mb-1">Join Quiz</h1>
          <p className="text-base-content/60 text-center text-sm mb-4">
            Enter the room code from your host
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              placeholder="ROOM CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              className="input input-bordered w-full text-center text-2xl font-mono tracking-widest uppercase"
            />
            <input
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="input input-bordered w-full"
            />
            <input
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="input input-bordered w-full"
            />
            <input
              placeholder="Nickname (shown in game)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              className="input input-bordered w-full"
            />
            {error && <p className="text-error text-sm">{error}</p>}
            <button type="submit" className="btn btn-primary w-full text-lg mt-1">
              Join →
            </button>
          </form>

          <p className="text-center text-xs text-base-content/40 mt-4">
            Hosting a quiz?{' '}
            <Link to="/host" className="link link-hover">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

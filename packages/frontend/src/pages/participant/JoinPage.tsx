import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Join Quiz</h1>
        <p className="text-gray-400 text-center text-sm mb-8">Enter the room code from your host</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            placeholder="Room Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            className="w-full bg-gray-800 text-white text-center text-2xl font-mono tracking-widest rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
          />
          <input
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Nickname (shown in game)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors text-lg"
          >
            Join →
          </button>
        </form>
      </div>
    </div>
  );
}

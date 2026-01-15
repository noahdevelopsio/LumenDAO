import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

function App() {
  const [account, setAccount] = useState('');
  const [verified, setVerified] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [proposals, setProposals] = useState([]);
  const [voteEvents, setVoteEvents] = useState([]);
  const [liquidDemocracy, setLiquidDemocracy] = useState(false);
  const [version, setVersion] = useState('current');

  // Mock data
  useEffect(() => {
    setProposals([
      {
        id: 1,
        description: 'Implement Quadratic Voting System',
        ipfsCID: 'QmX8nKzQ1W7n8Y9Z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z',
        voteCount: 24,
        endTime: Date.now() + 86400000,
        executed: false
      },
      {
        id: 2,
        description: 'Add Multi-Signature Treasury Management',
        ipfsCID: 'QmA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2',
        voteCount: 18,
        endTime: Date.now() + 86400000,
        executed: false
      },
      {
        id: 3,
        description: 'Enable Cross-Chain Governance Proposals',
        ipfsCID: 'QmG1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2',
        voteCount: 31,
        endTime: Date.now() + 86400000,
        executed: false
      },
    ]);
    setVoteEvents([
      { voter: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', proposalId: 1, vote: 1, timestamp: Date.now() - 3600000, nonce: 1 },
      { voter: '0x8ba1f109551bD432803012645ac136ddd64DBA72', proposalId: 1, vote: 1, timestamp: Date.now() - 1800000, nonce: 1 },
      { voter: '0x1234567890123456789012345678901234567890', proposalId: 2, vote: 2, timestamp: Date.now() - 900000, nonce: 1 },
      { voter: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', proposalId: 3, vote: 1, timestamp: Date.now() - 600000, nonce: 1 },
    ]);
  }, []);

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        setVerified(true); // Mock verified
        setNonce(1); // Mock nonce
      } else {
        alert('Please install MetaMask to connect your wallet!');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const vote = (proposalId, voteOption) => {
    if (!account) {
      alert('Please connect your wallet first!');
      return;
    }

    // Mock vote
    const newVoteEvent = {
      voter: account,
      proposalId,
      vote: voteOption,
      timestamp: Date.now(),
      nonce: nonce + 1
    };
    setVoteEvents([newVoteEvent, ...voteEvents]);
    setNonce(nonce + 1);

    // Update proposal vote count
    setProposals(proposals.map(p =>
      p.id === proposalId ? { ...p, voteCount: p.voteCount + 1 } : p
    ));
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimeRemaining = (endTime) => {
    const remaining = Math.max(0, endTime - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="App">
      <header className="header">
        <h1>LumenDAO</h1>
        <p>Decentralized Governance Dashboard</p>
      </header>

      <section className="wallet-section">
        {!account ? (
          <button className="connect-btn" onClick={connectWallet}>
            🔗 Connect Wallet
          </button>
        ) : (
          <div>
            <div className="user-info">
              <span>Connected: {formatAddress(account)}</span>
              {verified && <span className="verified-badge">✅ Verified</span>}
              <span className="nonce-display">Nonce: {nonce}</span>
            </div>
          </div>
        )}
      </section>

      {account && (
        <>
          <div className="controls">
            <div className="control-item">
              <label>Liquid Democracy:</label>
              <input
                type="checkbox"
                checked={liquidDemocracy}
                onChange={() => setLiquidDemocracy(!liquidDemocracy)}
              />
            </div>
            <div className="control-item">
              <label>Protocol Version:</label>
              <select value={version} onChange={(e) => setVersion(e.target.value)}>
                <option value="current">Current Rules</option>
                <option value="v1.0">Version 1.0</option>
                <option value="v0.9">Version 0.9</option>
              </select>
            </div>
          </div>

          <section className="proposals-section">
            <h2>📋 Active Proposals</h2>
            {proposals.map(p => (
              <div key={p.id} className="proposal-card">
                <h3>{p.description}</h3>
                <div className="proposal-info">
                  <div className="proposal-meta">
                    <span>📄 IPFS: {formatAddress(p.ipfsCID)}</span>
                    <span>🗳️ Votes: {p.voteCount}</span>
                    <span>⏰ Time Left: {formatTimeRemaining(p.endTime)}</span>
                  </div>
                  <div className="vote-buttons">
                    <button className="vote-btn" onClick={() => vote(p.id, 1)}>
                      ✅ Vote Yes
                    </button>
                    <button className="vote-btn" onClick={() => vote(p.id, 2)}>
                      ❌ Vote No
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="activity-section">
            <h2>📊 Activity Log</h2>
            <div className="activity-log">
              {voteEvents.map((e, i) => (
                <div key={i} className="activity-item">
                  <strong>{formatAddress(e.voter)}</strong> voted{' '}
                  <strong>{e.vote === 1 ? '✅ Yes' : '❌ No'}</strong> on Proposal #{e.proposalId}
                  <div className="activity-timestamp">
                    {new Date(e.timestamp).toLocaleString()} • Nonce: {e.nonce}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default App;

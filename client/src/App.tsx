import { useState } from 'react';
import { ethers } from 'ethers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Users, Vote, FileText, CheckCircle2, AlertCircle, Loader2, LogOut, ExternalLink } from "lucide-react";
import LumenDAOArtifact from './abi/LumenDAO.json';
import IdentityRegistryArtifact from './abi/IdentityRegistry.json';

// Declare window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

// REPLACE THESE WITH YOUR DEPLOYED CONTRACT ADDRESSES
const LUMEN_DAO_ADDRESS = import.meta.env.VITE_LUMEN_DAO_ADDRESS;
const IDENTITY_REGISTRY_ADDRESS = import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS;

// Types
interface Proposal {
  id: number;
  description: string;
  ipfsCID: string;
  voteCount: number;
  startTime: number;
  endTime: number;
  executed: boolean;
}

function App() {
  // State
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [daoContract, setDaoContract] = useState<ethers.Contract | null>(null);
  const [identityContract, setIdentityContract] = useState<ethers.Contract | null>(null);

  const [isVerified, setIsVerified] = useState(false);
  const [votingWeight, setVotingWeight] = useState<string>("0");
  const [delegatee, setDelegatee] = useState<string | null>(null);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  // Inputs
  const [delegateInput, setDelegateInput] = useState("");
  const [proposalDesc, setProposalDesc] = useState("");
  const [proposalIpfs, setProposalIpfs] = useState("");
  const [proposalDuration, setProposalDuration] = useState("86400"); // 1 day

  // Connect Wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await _provider.getSigner();
        const _account = await signer.getAddress();

        setProvider(_provider);
        setAccount(_account);

        // Fix: Use artifacts directly if they are arrays, or .abi if objects.
        // In our case, we copied the array directly.
        const _dao = new ethers.Contract(LUMEN_DAO_ADDRESS, LumenDAOArtifact, signer);
        const _identity = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IdentityRegistryArtifact, signer);

        setDaoContract(_dao);
        setIdentityContract(_identity);

        // Load initial data
        checkIdentity(_identity, _account);
        loadVotingWeight(_dao, _account);
        loadDelegate(_dao, _account);
        loadProposals(_dao);

      } catch (err) {
        console.error("Failed to connect wallet:", err);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const checkIdentity = async (contract: ethers.Contract, addr: string) => {
    try {
      const verified = await contract.isVerified(addr);
      setIsVerified(verified);
    } catch (e) {
      console.error("Error checking identity", e);
    }
  };

  const loadVotingWeight = async (contract: ethers.Contract, addr: string) => {
    try {
      const weight = await contract.getVotingWeight(addr);
      setVotingWeight(weight.toString());
    } catch (e) {
      console.error("Error loading weight", e);
    }
  };

  const loadDelegate = async (contract: ethers.Contract, addr: string) => {
    try {
      const d = await contract.delegates(addr);
      if (d && d !== ethers.ZeroAddress) {
        setDelegatee(d);
      }
    } catch (e) {
      console.error("Error loading delegate", e);
    }
  };

  const loadProposals = async (contract: ethers.Contract) => {
    setLoadingProposals(true);
    try {
      const count = await contract.proposalCount();
      const loaded: Proposal[] = [];
      for (let i = 1; i <= Number(count); i++) {
        const p = await contract.proposals(i);
        loaded.push({
          id: i,
          description: p.description,
          ipfsCID: p.ipfsCID,
          voteCount: Number(p.voteCount),
          startTime: Number(p.startTime),
          endTime: Number(p.endTime),
          executed: p.executed
        });
      }
      setProposals(loaded);
    } catch (e) {
      console.error("Error loading proposals", e);
    } finally {
      setLoadingProposals(false);
    }
  };

  // Actions
  const verifyIdentity = async () => {
    if (!identityContract || !account) return;
    try {
      alert("Please ask the DAO Admin (Deployer) to verify your account: " + account);
    } catch (e) {
      console.error(e);
    }
  };

  const createProposal = async () => {
    if (!daoContract) return;
    try {
      const tx = await daoContract.createProposal(proposalDesc, proposalIpfs, proposalDuration);
      await tx.wait();
      loadProposals(daoContract);
      alert("Proposal Created!");
    } catch (e) {
      console.error(e);
      alert("Failed to create proposal");
    }
  };

  const delegateVote = async () => {
    if (!daoContract) return;
    try {
      const tx = await daoContract.delegate(delegateInput);
      await tx.wait();
      loadDelegate(daoContract, account!);
      loadVotingWeight(daoContract, account!);
      alert("Delegation successful!");
    } catch (e) {
      console.error(e);
      alert("Delegation failed");
    }
  };

  const castVote = async (proposalId: number, option: number) => {
    // EIP-712 Signature Vote
    if (!daoContract || !provider || !account) return;

    try {
      const domain = {
        name: 'LumenDAO',
        version: '1',
        chainId: (await provider.getNetwork()).chainId,
        verifyingContract: await daoContract.getAddress()
      };

      const types = {
        Vote: [
          { name: 'proposalId', type: 'uint256' },
          { name: 'voteOption', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const nonce = await daoContract.nonces(account);
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      const value = {
        proposalId,
        voteOption: option,
        nonce,
        deadline
      };

      const signature = await provider.getSigner().then(s => s.signTypedData(domain, types, value));
      const sig = ethers.Signature.from(signature);

      const tx = await daoContract.executeVoteBySig(
        proposalId,
        option,
        nonce,
        deadline,
        sig.v,
        sig.r,
        sig.s
      );
      await tx.wait();
      alert("Vote Cast Successfully via EIP-712!");
      loadProposals(daoContract);
    } catch (e) {
      console.error(e);
      alert("Voting failed: " + (e as any).message);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">LumenDAO</span>
          </div>
          <div className="flex items-center gap-4">
            {account ? (
              <div className="flex items-center gap-2">
                <Badge variant={isVerified ? "default" : "destructive"} className="gap-1">
                  {isVerified ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {isVerified ? "Verified Identity" : "Unverified"}
                </Badge>
                <div className="text-sm font-medium hidden sm:block">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setAccount(null)}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={connectWallet}>Connect Wallet</Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 flex-1">
        {!account ? (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center">
            <Shield className="h-16 w-16 text-muted-foreground/50" />
            <h2 className="text-2xl font-bold">Welcome to LumenDAO</h2>
            <p className="text-muted-foreground max-w-md">
              A self-sovereign governance framework powered by privacy-preserving identity and delegation.
            </p>
            <Button size="lg" onClick={connectWallet} className="mt-4">
              Connect to Participate
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="proposals" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
              <TabsTrigger value="proposals" className="gap-2"><FileText className="h-4 w-4" /> Proposals</TabsTrigger>
              <TabsTrigger value="voting" className="gap-2"><Vote className="h-4 w-4" /> Vote</TabsTrigger>
              <TabsTrigger value="delegation" className="gap-2"><Users className="h-4 w-4" /> Delegate</TabsTrigger>
              <TabsTrigger value="identity" className="gap-2"><Shield className="h-4 w-4" /> Identity</TabsTrigger>
            </TabsList>

            {/* Proposals Tab */}
            <TabsContent value="proposals" className="space-y-4 animate-in fade-in-50">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Active Proposals</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>Create Proposal</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Proposal</DialogTitle>
                      <DialogDescription>
                        Submit a new governance proposal for community voting.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input placeholder="E.g., Increase grants budget..." value={proposalDesc} onChange={(e) => setProposalDesc(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>IPFS CID (Artifact)</Label>
                        <Input placeholder="QmHash..." value={proposalIpfs} onChange={(e) => setProposalIpfs(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration (Seconds)</Label>
                        <Input type="number" value={proposalDuration} onChange={(e) => setProposalDuration(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createProposal}>Submit Proposal</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loadingProposals ? (
                  <div className="col-span-full flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : proposals.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-muted-foreground">No proposals found</div>
                ) : (
                  proposals.map((p) => (
                    <Card key={p.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">Proposal #{p.id}</CardTitle>
                          {p.executed ? <Badge variant="secondary">Executed</Badge> : <Badge>Active</Badge>}
                        </div>
                        <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex justify-between">
                            <span>Vote Count:</span>
                            <span className="font-medium text-foreground">{p.voteCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CID:</span>
                            <a href={`https://ipfs.io/ipfs/${p.ipfsCID}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button className="w-full" disabled={p.executed} variant={p.executed ? "outline" : "default"}>
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Voting Tab */}
            <TabsContent value="voting" className="space-y-4 animate-in fade-in-50">
              <Card>
                <CardHeader>
                  <CardTitle>Cast Your Vote</CardTitle>
                  <CardDescription>Sign a message off-chain to cast your vote gaslessly (EIP-712).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {proposals.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">#{p.id} {p.description}</p>
                        <p className="text-sm text-muted-foreground">Ends: {new Date(p.endTime * 1000).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => castVote(p.id, 1)} className="text-green-600 hover:text-green-700 hover:bg-green-50">For</Button>
                        <Button variant="outline" size="sm" onClick={() => castVote(p.id, 0)} className="text-red-600 hover:text-red-700 hover:bg-red-50">Against</Button>
                        <Button variant="outline" size="sm" onClick={() => castVote(p.id, 2)}>Abstain</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Delegation Tab */}
            <TabsContent value="delegation" className="space-y-4 animate-in fade-in-50">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Voting Power</CardTitle>
                    <CardDescription>Calculated from your identity + received delegations.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">{votingWeight}</div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Base Weight: 1<br />
                      Delegated To You: {Number(votingWeight) > 0 ? Number(votingWeight) - 1 : 0}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Delegate Vote</CardTitle>
                    <CardDescription>Entrust your voting power to another verified identity.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Delegate Address</Label>
                      <Input placeholder="0x..." value={delegateInput} onChange={(e) => setDelegateInput(e.target.value)} />
                    </div>
                    {delegatee && (
                      <div className="p-2 bg-muted rounded text-sm">
                        Currently delegating to: <span className="font-mono">{delegatee}</span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={delegateVote}>
                      {delegatee ? "Change Delegation" : "Delegate Power"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-4 animate-in fade-in-50">
              <Card>
                <CardHeader>
                  <CardTitle>Identity Management</CardTitle>
                  <CardDescription>Manage your Soulbound Token (SBT) status.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isVerified ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{isVerified ? "Verified Citizen" : "Unverified Guest"}</h4>
                      <p className="text-sm text-muted-foreground">
                        {isVerified ? "You have full voting and delegation rights." : "You must verify your identity to participate."}
                      </p>
                    </div>
                    {!isVerified && (
                      <Button className="ml-auto" onClick={verifyIdentity}>Verify Now</Button>
                    )}
                  </div>

                  {isVerified && (
                    <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 space-y-2">
                      <h4 className="font-semibold text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> Danger Zone
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Revoking your identity is permanent until restored by a Guardian.
                      </p>
                      <Button variant="destructive" size="sm" onClick={() => alert("Revocation functionality would go here (calling revokeKey)")}>
                        Revoke Identity
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

export default App;

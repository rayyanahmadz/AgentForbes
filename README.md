# 🚀 AgentForge AI

> Build, manage, and collaborate with AI employees inside your own AI-powered organization.

AgentForge AI is a full-stack SaaS platform that allows organizations to create AI employees, organize them into teams, automate workflows, manage knowledge bases, purchase AI credits, and collaborate through intelligent conversations.

---

## ✨ Features

### 🤖 AI Employees
- Create unlimited AI employees
- Custom instructions and personalities
- Google Gemini integration
- Individual chat interface
- Long-term memory support
- Knowledge source attachment

---

### 📚 Knowledge Base
- Upload Markdown or text knowledge
- Attach knowledge to employees
- AI responses grounded in uploaded content
- Multiple knowledge sources per employee

---

### 🧠 Memory
- Persistent employee memory
- Cross-conversation context
- Memory management interface

---

### 👥 Teams
- Create AI teams
- Assign lead AI employee
- Multiple team members
- Intelligent routing between employees
- Team chat interface

---

### ⚙️ Workflows
- Multi-step AI workflows
- Chain multiple employees together
- Automated execution
- Visual workflow builder

---

### 💬 Conversations
- Real-time AI chat
- Conversation history
- Streaming responses
- Organization-scoped conversations

---

### 💳 Wallet & Credits
- Credit-based AI usage
- Stripe Checkout integration
- Manual bank transfer support
- Payment approvals
- Wallet transaction history
- Credit tracking

---

### 🛍 Marketplace
- Publish AI employees
- Install marketplace employees
- Browse community AI agents

---

### 🏢 Organizations
- Multi-organization support
- Team collaboration
- Organization API keys
- Member management

---

### 📊 Dashboard
- Analytics
- Employee management
- Workflow management
- Wallet overview
- Platform administration

---

## 🛠 Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query

### Backend
- Supabase
- PostgreSQL
- Edge Functions (Deno)

### AI
- Google Gemini API

### Payments
- Stripe Checkout
- Manual Bank Transfer

### Authentication
- Supabase Auth

### Deployment
- Vercel
- Supabase

---

## 📂 Project Structure

```
apps/
  web/

packages/
  ui/

supabase/
  functions/
  migrations/

docs/
```

---

## 🚀 Getting Started

### Clone

```bash
git clone (https://github.com/rayyanahmadz/agentforge-ai.git)

cd agentforge-ai
```

---

### Install

```bash
pnpm install
```

---

### Environment Variables

Create a `.env` file.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

### Run

```bash
pnpm dev
```

---

### Build

```bash
pnpm build
```

---

## 💳 Payment System

AgentForge supports two payment methods:

### Stripe
- Secure Checkout
- Automatic webhook verification
- Instant credit allocation

### Manual Bank Transfer
- Customer submits payment reference
- Admin verification
- Manual approval
- Credits added after approval

---

## 🤖 AI Providers

Currently supported:

- ✅ Google Gemini

Planned:

- OpenAI
- Claude
- Grok
- DeepSeek
- Mistral

---

## 🔐 Authentication

- Secure Supabase Authentication
- Organization-based access
- Row Level Security (RLS)
- Protected API routes

---

## 🎯 Future Improvements

- Voice AI
- Image generation
- PDF knowledge upload
- Vector search
- API marketplace
- AI analytics
- Mobile application
- Multi-model routing

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

## 📄 License

MIT License

---

## 👨‍💻 Author

**Rayyan Ahmad**

Computer Science Student • Full Stack Developer • AI Enthusiast

GitHub:
https://github.com/rayyanahmadz

---

## ⭐ Support

If you found this project useful, consider giving it a ⭐ on GitHub.

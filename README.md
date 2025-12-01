# Sleek Loan Manager

A visually stunning and highly functional loan management application featuring a sophisticated glassmorphism design and engaging animations to enhance user experience.

git add . && git commit -m "Descriptive summary of changes" && git push origin main

Reset local Commits
git fetch --all
git checkout main
git reset --hard origin/main
git clean -fd
git pull

---

## ✨ Features

- **Customer Management:**  
  Add, view, search, and delete customers with ease.

- **Loan Tracking:**  
  Record new loans, track repayments, interest, and late fees. Visual progress bars for each loan.

- **Installment Management:**  
  Record, view, and delete installments for each loan. Automatic calculation of paid and remaining installments.

- **Subscription Management:**  
  Track annual subscriptions for customers, including receipts and payment dates.

- **WhatsApp Integration:**  
  Instantly send payment confirmations and reminders to customers via WhatsApp.

- **Data Export:**  
  Export comprehensive reports (customers, loans, subscriptions, installments) to Excel with a single click.

- **Authentication:**  
  Secure login system powered by Supabase.

- **Modern UI:**  
  Responsive, glassmorphic interface with smooth animations.

- **Automatic User Provisioning:**  
  When a new customer is added, a user account is automatically created in Supabase with email `{phonenumber}@gmail.com` and password `{phonenumber}`.

- **Password Management:**  
  Users can change their password after login through the secure change password modal.

- **Scoped Data Access:**  
  Customers can only view and manage their own loans, subscriptions, and misc entries. Admin-only pages are hidden from customers, and all data queries are filtered at the database level for maximum security.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- A [Supabase](https://supabase.com/) project (for authentication & database)
- (Optional) [Gemini API Key](https://ai.google.dev/) for AI features

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-username/sleek-loan-manager.git
   cd sleek-loan-manager
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your Supabase URL and anon key:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run the development server:**
   ```sh
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build and run for production:**
   ```sh
   npm run build
   npm start
   ```
   Your app will be available at [http://localhost:3000](http://localhost:3000).

---

## 📁 File Structure

```
.
├── App.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── auth/
│   ├── modals/
│   ├── pages/
│   └── ui/
├── context/
├── src/
│   └── lib/
├── utils/
├── types.ts
├── constants.tsx
├── ...
```

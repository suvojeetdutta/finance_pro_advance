# Finance Pro

A comprehensive personal finance management application that helps you track expenses, income, budgets, and gain insights into your financial health. Works seamlessly on both desktop and mobile devices.

![Finance Pro Advance](https://img.shields.io/badge/Version-2.0-blue) ![Platform-Web](https://img.shields.io/badge/Platform-Web-green) ![License-MIT](https://img.shields.io/badge/License-MIT-yellow)

## Features

### 📊 Dashboard
- **Fixed Expenses Overview**: Visual bar chart of recurring monthly expenses
- **Day-wise Expenses**: Interactive bar graph showing daily spending patterns per month
- **Monthly Summary**: Overview of total income, expenses, and savings
- **Quick Stats**: Current month totals with comparison to previous month

### 💰 Expense Tracking
- Add, edit, and delete expenses with categories and subcategories
- Support for both one-time and recurring (fixed) expenses
- Multiple payment methods tracking
- Receipt attachment support
- Quick add expense functionality

### 💵 Income Management
- Track multiple income sources
- Salary, freelance, investment income tracking
- Monthly income summaries

### 📈 Budgets
- Set monthly budget limits per category
- Visual progress bars showing budget usage
- Alerts when approaching budget limits
- Category-wise budget allocation

### 🔍 History
- Complete transaction history with filters
- Search by date, category, amount, or description
- Sort and filter capabilities
- Export data to JSON

### 📉 Analytics
- **Income vs Expense Chart**: Compare monthly income and expenses
- **Savings Rate**: Track your savings percentage
- **Average Daily Spend**: Monitor daily spending patterns
- **Category Breakdown**: Pie chart analysis of expenses by category
- **Trend Analysis**: Year-over-year comparison insights
- **Monthly Comparison**: Compare spending across different months

### 🌙 Dark Mode
- Toggle between light and dark themes
- Persistent theme preference via localStorage
- Optimized chart colors for both themes

### ☁️ Cloud Sync
- Supabase integration for cloud backup
- Manual and automatic sync options
- Sync status indicator
- Import/Export functionality for data backup

### 📱 Mobile Responsive
- Fully responsive design
- Touch-friendly interface
- Sidebar navigation on desktop
- Hamburger menu on mobile
- PWA support with service worker

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Supabase account (optional, for cloud sync)

### Installation

1. **Clone or download the repository**
   ```bash
   git clone https://github.com/suvojeetdutta/finance_pro_advance.git
   cd finance_pro_advance
   ```

2. **Configure Supabase (Optional)**
   - Create a project at [supabase.com](https://supabase.com)
   - Run the SQL setup file:
     ```bash
     # Open Supabase SQL Editor and run:
     supabase_setup.sql
     ```
   - Copy `config.example.js` to `config.js`:
     ```javascript
     // config.js
     const SUPABASE_URL = 'your-project-url';
     const SUPABASE_KEY = 'your-anon-key';
     ```

3. **Open the application**
   - Simply open `index.html` in your browser
   - Or serve via a local server:
     ```bash
     # Using Python
     python -m http.server 8000
     # Using Node.js
     npx serve .
     ```

### Usage

1. **First Launch**: Create an account or log in
2. **Add Expenses**: Click "+" button or use the add form
3. **Set Budgets**: Navigate to Budgets section
4. **View Analytics**: Check Analytics for financial insights
5. **Enable Sync**: Configure Supabase for cloud backup

## Project Structure

```
expense_tracker_advance/
├── index.html          # Main HTML file
├── app.js              # Core application logic
├── styles.css          # Styling (responsive)
├── sync.js             # Supabase synchronization
├── config.js           # API configuration
├── config.example.js   # Configuration template
├── sw.js               # Service worker (PWA)
├── manifest.json       # PWA manifest
├── supabase_setup.sql  # Database schema
└── icons/              # App icons
```

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Charts**: Chart.js
- **Icons**: Font Awesome
- **Backend**: Supabase (optional cloud sync)
- **Storage**: localStorage (offline) + Supabase (cloud)
- **PWA**: Service Worker API

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome  | 80+     |
| Firefox | 75+     |
| Safari  | 13+     |
| Edge   | 80+     |

## Data Export/Import

### Export Data
1. Go to sidebar
2. Click "Export" button
3. JSON file will be downloaded

### Import Data
1. Go to sidebar  
2. Click "Import" button
3. Select previously exported JSON file
4. Data will be merged with existing records

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Chart.js](https://www.chartjs.org/) for beautiful charts
- [Font Awesome](https://fontawesome.com/) for icons
- [Supabase](https://supabase.com/) for cloud backend

---

**Note**: This application stores data locally in your browser. For long-term data safety, enable cloud sync or regularly export your data.

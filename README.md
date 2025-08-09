# MoneyMind - A Client-Side Finance Tracker

MoneyMind is a modern, responsive, and entirely client-side financial tracker designed to help you manage your income, expenses, and savings goals with ease. All your data is stored securely in your browser's local storage, meaning you don't need a backend server or an account with a third-party service.

**Note:** A live demo link can be added here once the project is deployed.

---

## ✨ Features

* **Secure Authentication:** Log in with a traditional email and password or instantly with your Google account.
* **Dashboard Overview:** Get a quick snapshot of your total balance, monthly income vs. expenses, and savings rate.
* **Account Management:** Add and manage multiple accounts (e.g., Savings, Checking, Cash).
* **Transaction Tracking:** Easily log income and expense transactions, assigning them to categories and accounts.
* **Budgeting Categories:** Create custom spending categories with monthly budgets to monitor your spending.
* **Financial Goals:** Set and track your progress towards savings goals like an emergency fund or a vacation.
* **Interactive Calendar:** Visualize your transaction history on a full-featured calendar.
* **Data Export:** Export your transaction data to PDF or CSV for your records.
* **Fully Responsive:** A clean and modern UI that works beautifully on desktop, tablets, and mobile devices.
* **AI Features (Coming Soon):** Future updates will include AI-powered insights and suggestions.

---

## 🛠️ Technologies Used

* **Frontend:** HTML5, CSS3, JavaScript (ES6+)
* **Libraries:**
    * [FullCalendar](https://fullcalendar.io/) - For the interactive transaction calendar.
    * [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) - For generating PDF reports.
    * [Font Awesome](https://fontawesome.com/) - For icons.

---

## 🚀 Setup and Installation

To run this project on your local machine, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/YourUsername/moneymind-app.git](https://github.com/YourUsername/moneymind-app.git)
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd moneymind-app
    ```

3.  **Run a local server:**
    Since the application uses Google Sign-In, you need to serve the files from a web server. The easiest way is to use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension in VS Code.
    * Right-click on `index.html`.
    * Select "Open with Live Server".
    * This will typically open the project at `http://127.0.0.1:5500`.

---

## ⚙️ Configuration for Google Sign-In

For the Google Sign-In functionality to work, you must create your own **OAuth 2.0 Client ID** and configure it correctly.

1.  **Create a Google Cloud Project:** Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.

2.  **Create an OAuth 2.0 Client ID:**
    * Navigate to **APIs & Services > Credentials**.
    * Click **Create Credentials > OAuth client ID**.
    * Select **Web application** as the application type.

3.  **Configure the Client ID:**
    * **Update `index.html`:** Find the `div` with the `id="g_id_onload"` and replace the `data-client_id` with your new Client ID.
    * **Add Authorized JavaScript origins:** This is the most critical step. You must tell Google which URLs are allowed to use this Client ID. Add the following:
        * `http://localhost:5500` (or your local server's port)
        * Your live site's origin (e.g., `https://YourUsername.github.io`)

    > **Important:** The origin URI must not contain a path or a trailing slash. For example, use `https://YourUsername.github.io`, not `https://YourUsername.github.io/moneymind-app/`.

---

## 📄 License

This project is licensed under the MIT License.

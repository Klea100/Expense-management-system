const SibApiV3Sdk = require("sib-api-v3-sdk");
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.isBrevoConfigured = false;
    this.isBackupConfigured = false;
    this.initializeBrevo();
    this.initializeBackupTransporter();
  }

  // Initialize Brevo/Sendinblue API
  initializeBrevo() {
    try {
      if (process.env.BREVO_API_KEY) {
        const defaultClient = SibApiV3Sdk.ApiClient.instance;
        const apiKey = defaultClient.authentications["api-key"];
        apiKey.apiKey = process.env.BREVO_API_KEY;
        this.brevoApi = new SibApiV3Sdk.TransactionalEmailsApi();
        this.isBrevoConfigured = true;
        console.log("Brevo email service initialized");
      } else {
        console.warn(
          "BREVO_API_KEY not configured - email alerts will use fallback method"
        );
      }
    } catch (error) {
      console.error("Failed to initialize Brevo service:", error);
    }
  }

  // Initialize backup nodemailer transporter (for testing/fallback)
  initializeBackupTransporter() {
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.backupTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        this.isBackupConfigured = true;
        console.log("Backup email transporter initialized (SMTP)");
      } else {
        // Fallback to local JSON transport (no network)
        this.backupTransporter = nodemailer.createTransport({ jsonTransport: true });
        this.isBackupConfigured = true;
        console.log("Backup email transporter initialized (jsonTransport)");
      }
    } catch (error) {
      console.error("Failed to initialize backup email transporter:", error);
    }
  }

  // Send budget alert email
  async sendBudgetAlert(team, alertType, budgetUtilization) {
    try {
      // If no email services are configured, log the alert instead
      if (!this.isBrevoConfigured && !this.isBackupConfigured) {
        console.log(
          `EMAIL ALERT: Team "${team.name}" - ${alertType} budget alert (${budgetUtilization}% utilized)`
        );
        return {
          success: true,
          provider: "console-log",
          message: "Alert logged to console",
        };
      }

      const emailData = this.prepareBudgetAlertEmail(
        team,
        alertType,
        budgetUtilization
      );

      // Try Brevo first
      if (this.brevoApi && this.isBrevoConfigured) {
        try {
          const result = await this.sendWithBrevo(emailData);
          console.log(`Budget alert sent via Brevo for team ${team.name}`);
          return {
            success: true,
            provider: "brevo",
            messageId: result.messageId,
          };
        } catch (brevoError) {
          console.error("Brevo email failed, trying backup:", brevoError);
        }
      }

      // Fallback to backup transporter or mock
      const result = await this.sendWithBackup(emailData);
      console.log(`Budget alert sent via backup for team ${team.name}`);
      return { success: true, provider: "backup", messageId: result.messageId };
    } catch (error) {
      console.error("All email services failed:", error);
      return {
        success: false,
        error: error.message,
        fallback: this.logEmailToConsole(team, alertType, budgetUtilization),
      };
    }
  }

  // Prepare budget alert email content
  prepareBudgetAlertEmail(team, alertType, budgetUtilization) {
    const isWarning = alertType === "warning";
    const isCritical = alertType === "critical";

    const subject = isWarning
      ? `⚠️ Budget Warning: ${team.name} at ${budgetUtilization}% of budget`
      : `🚨 Budget Alert: ${team.name} ${
          budgetUtilization >= 100 ? "EXCEEDED" : "CRITICAL"
        } budget usage`;

    const urgencyLevel = isWarning ? "Warning" : "Critical";
    const statusColor = isWarning ? "#ff9800" : "#f44336";
    const actionRequired = isCritical
      ? "Immediate action required - spending should be restricted"
      : "Please review upcoming expenses and consider deferring non-essential items";

    // Get team manager emails for recipients
    const recipients = this.getTeamManagerEmails(team);

    const htmlContent = this.generateBudgetAlertHtml({
      teamName: team.name,
      budgetUtilization,
      totalSpent: team.totalSpent,
      budget: team.budget,
      remainingBudget: team.remainingBudget || team.budget - team.totalSpent,
      urgencyLevel,
      statusColor,
      actionRequired,
      isWarning,
      isCritical,
    });

    const textContent = this.generateBudgetAlertText({
      teamName: team.name,
      budgetUtilization,
      totalSpent: team.totalSpent,
      budget: team.budget,
      remainingBudget: team.remainingBudget || team.budget - team.totalSpent,
      urgencyLevel,
      actionRequired,
    });

    return {
      to: recipients,
      subject,
      htmlContent,
      textContent,
      metadata: {
        teamId: team._id,
        alertType,
        budgetUtilization,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Get team manager email addresses
  getTeamManagerEmails(team) {
    const emails = [];

    // Add team managers
    if (team.members && team.members.length > 0) {
      team.members.forEach((member) => {
        if (member.role === "manager" && member.isActive && member.email) {
          emails.push({
            email: member.email,
            name: member.name,
          });
        }
      });
    }

    // Fallback: add all active members if no managers found
    if (emails.length === 0 && team.members && team.members.length > 0) {
      team.members.forEach((member) => {
        if (member.isActive && member.email) {
          emails.push({
            email: member.email,
            name: member.name,
          });
        }
      });
    }

    // Ultimate fallback: use environment variable
    if (emails.length === 0 && process.env.SENDER_EMAIL) {
      emails.push({
        email: process.env.SENDER_EMAIL,
        name: "Team Manager",
      });
    }

    return emails;
  }

  // Generate HTML email content
  generateBudgetAlertHtml({
    teamName,
    budgetUtilization,
    totalSpent,
    budget,
    remainingBudget,
    urgencyLevel,
    statusColor,
    actionRequired,
    isWarning,
    isCritical,
  }) {
    const formattedBudget = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(budget);

    const formattedSpent = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(totalSpent);

    const formattedRemaining = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(remainingBudget);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Budget Alert - ${teamName}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
                .alert-level { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                .budget-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
                .progress-bar { background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
                .progress-fill { background: ${statusColor}; height: 100%; width: ${Math.min(
      budgetUtilization,
      100
    )}%; transition: width 0.3s ease; }
                .stats { display: flex; justify-content: space-between; margin: 15px 0; }
                .stat { text-align: center; }
                .stat-value { font-size: 18px; font-weight: bold; color: ${statusColor}; }
                .stat-label { font-size: 12px; color: #666; }
                .action-box { background: ${
                  isWarning ? "#fff3cd" : "#f8d7da"
                }; border: 1px solid ${
      isWarning ? "#ffeaa7" : "#f5c6cb"
    }; padding: 15px; border-radius: 5px; margin: 15px 0; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="alert-level">${urgencyLevel} Budget Alert</div>
                    <h2>Team: ${teamName}</h2>
                </div>
                <div class="content">
                    <div class="budget-info">
                        <h3>Budget Overview</h3>
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <div class="stats">
                            <div class="stat">
                                <div class="stat-value">${budgetUtilization}%</div>
                                <div class="stat-label">Utilized</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${formattedSpent}</div>
                                <div class="stat-label">Spent</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${formattedBudget}</div>
                                <div class="stat-label">Budget</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${formattedRemaining}</div>
                                <div class="stat-label">Remaining</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="action-box">
                        <h4>Action Required</h4>
                        <p>${actionRequired}</p>
                        ${
                          isCritical
                            ? `
                        <ul>
                            <li>Review all pending expenses immediately</li>
                            <li>Defer non-essential purchases</li>
                            <li>Contact finance team if budget increase needed</li>
                            <li>Monitor daily spending closely</li>
                        </ul>
                        `
                            : `
                        <ul>
                            <li>Review upcoming planned expenses</li>
                            <li>Consider deferring non-urgent purchases</li>
                            <li>Monitor spending velocity</li>
                        </ul>
                        `
                        }
                    </div>
                    
                    <p><strong>This alert was generated automatically by the Team Expense Management System.</strong></p>
                    <p>For questions or to request budget adjustments, please contact your finance administrator.</p>
                </div>
                <div class="footer">
                    <p>Team Expense Management System | Generated on ${new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </body>
        </html>
        `;
  }

  // Generate text email content
  generateBudgetAlertText({
    teamName,
    budgetUtilization,
    totalSpent,
    budget,
    remainingBudget,
    urgencyLevel,
    actionRequired,
  }) {
    const formattedBudget = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(budget);

    const formattedSpent = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(totalSpent);

    const formattedRemaining = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(remainingBudget);

    return `
${urgencyLevel} BUDGET ALERT - Team: ${teamName}

Budget Utilization: ${budgetUtilization}%
Total Spent: ${formattedSpent}
Total Budget: ${formattedBudget}
Remaining Budget: ${formattedRemaining}

ACTION REQUIRED:
${actionRequired}

This alert was generated automatically by the Team Expense Management System.
Generated on: ${new Date().toLocaleDateString()}

For questions or budget adjustments, contact your finance administrator.
        `.trim();
  }

  // Send email via Brevo
  async sendWithBrevo(emailData) {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = emailData.subject;
    sendSmtpEmail.htmlContent = emailData.htmlContent;
    sendSmtpEmail.textContent = emailData.textContent;
    sendSmtpEmail.sender = {
      name: process.env.SENDER_NAME || "Team Expense System",
      email: process.env.SENDER_EMAIL || "noreply@teamexpenses.com",
    };
    sendSmtpEmail.to = emailData.to;
    sendSmtpEmail.headers = {
      "X-Team-ID": emailData.metadata.teamId,
      "X-Alert-Type": emailData.metadata.alertType,
    };

    const result = await this.brevoApi.sendTransacEmail(sendSmtpEmail);
    return result;
  }

  // Send email via backup transporter
  async sendWithBackup(emailData) {
    if (!this.backupTransporter) {
      // Should not happen, but guard anyway
      this.initializeBackupTransporter();
    }

    const mailOptions = {
      from: `"${process.env.SENDER_NAME || "Team Expense System"}" <${
        process.env.SENDER_EMAIL || "noreply@teamexpenses.com"
      }>`,
      to: emailData.to.map((t) => `"${t.name}" <${t.email}>`).join(", "),
      subject: emailData.subject,
      text: emailData.textContent,
      html: emailData.htmlContent,
    };

    return await this.backupTransporter.sendMail(mailOptions);
  }

  // Log email to console (ultimate fallback)
  logEmailToConsole(team, alertType, budgetUtilization) {
    console.log(`
=== BUDGET ALERT EMAIL (Console Log) ===
Team: ${team.name}
Alert Type: ${alertType}
Budget Utilization: ${budgetUtilization}%
Total Spent: $${team.totalSpent}
Budget: $${team.budget}
Recipients: ${
      team.members
        ? team.members
            .map((m) => m.email)
            .filter(Boolean)
            .join(", ")
        : "None"
    }
Timestamp: ${new Date().toISOString()}
=======================================
        `);

    return { logged: true, timestamp: new Date().toISOString() };
  }

  // Send test email
  async sendTestEmail(to, subject = "Test Email from Team Expense System") {
    try {
      const emailData = {
        to: Array.isArray(to) ? to : [{ email: to, name: "Test User" }],
        subject: subject,
        htmlContent: `
                    <h2>Test Email</h2>
                    <p>This is a test email from the Team Expense Management System.</p>
                    <p>If you received this, the email service is working correctly.</p>
                    <p>Sent at: ${new Date().toISOString()}</p>
                `,
        textContent: `
Test Email

This is a test email from the Team Expense Management System.
If you received this, the email service is working correctly.

Sent at: ${new Date().toISOString()}
                `,
        metadata: {
          type: "test",
          timestamp: new Date().toISOString(),
        },
      };

      // Try Brevo first, then backup
      if (this.brevoApi && this.isBrevoConfigured) {
        try {
          const result = await this.sendWithBrevo(emailData);
          return { success: true, provider: "brevo", result };
        } catch (brevoError) {
          console.error("Brevo test failed:", brevoError);
        }
      }

      const result = await this.sendWithBackup(emailData);
      return { success: true, provider: "backup", result };
    } catch (error) {
      console.error("Test email failed:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();

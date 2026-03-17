import { contactTools } from "./contacts";
import { emailTools } from "./email";
import { callTools } from "./calls";
import { calendarTools } from "./calendar";
import { approvalTools } from "./approvals";
import { spaceTools } from "./spaces";
import { settingsTools } from "./settings";
import { gmailTools } from "./gmail";
import { aiEmailTools } from "./ai-email";

export const allTools = {
  ...contactTools,
  ...emailTools,
  ...callTools,
  ...calendarTools,
  ...approvalTools,
  ...spaceTools,
  ...settingsTools,
  ...gmailTools,
  ...aiEmailTools,
};

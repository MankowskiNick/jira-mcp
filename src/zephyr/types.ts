// Type definitions for Zephyr API

// Type for Zephyr test step response
export type ZephyrTestStep = {
  id: number;
  orderId: number;
  step: string;
  data?: string;
  result?: string;
  [key: string]: any;
};

// Type for Zephyr add test step response
export type ZephyrAddTestStepResponse = {
  id?: number;
  orderId?: number;
  step?: string;
  data?: string;
  result?: string;
  [key: string]: any;
};

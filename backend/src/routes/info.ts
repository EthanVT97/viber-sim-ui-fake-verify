import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(
      `https://chatapi.viber.com/pa/get_account_info`,
      {},
      {
        headers: {
          'X-Viber-Auth-Token': config.VIBER_AUTH_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status !== 0) {
      return res.status(400).json({
        error: 'Failed to get bot info',
        details: response.data
      });
    }

    res.json(response.data);
  } catch (error) {
    logger.error('Get bot info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as infoRoutes };

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

const sendMessageValidation = [
  body('receiver').notEmpty().withMessage('Receiver is required'),
  body('text').notEmpty().withMessage('Text is required'),
  body('type').optional().isIn(['text', 'picture', 'video', 'file', 'sticker', 'contact', 'url', 'location']).withMessage('Invalid message type')
];

router.post('/', sendMessageValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { receiver, text, type = 'text', media, keyboard, ...otherProps } = req.body;

    const messagePayload: any = {
      receiver,
      type,
      text
    };

    if (media) {
      messagePayload.media = media;
    }

    if (keyboard) {
      messagePayload.keyboard = keyboard;
    }

    Object.assign(messagePayload, otherProps);

    const response = await axios.post(
      'https://chatapi.viber.com/pa/send_message',
      messagePayload,
      {
        headers: {
          'X-Viber-Auth-Token': config.VIBER_AUTH_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status !== 0) {
      return res.status(400).json({
        error: 'Failed to send message',
        details: response.data
      });
    }

    res.json({
      success: true,
      message_token: response.data.message_token,
      chat_hostname: response.data.chat_hostname
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as sendRoutes };

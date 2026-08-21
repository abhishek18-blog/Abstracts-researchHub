import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET;

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

const setAuthCookie = (res, token) => {
    res.cookie('token', token, COOKIE_OPTIONS);
};

// ─────────────────────────────────────────────
// 📱 GOOGLE MOBILE LOGIN — Direct email lookup/creation in MongoDB
// ─────────────────────────────────────────────
export const googleMobileLogin = async (req, res) => {
    try {
        const { email, name, avatar_url } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        let user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            user = new User({
                name: name || normalizedEmail.split('@')[0],
                email: normalizedEmail,
                password: '',
                role: 'Student',
                avatar_initials: (name || normalizedEmail).substring(0, 2).toUpperCase(),
                avatar_url: avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || normalizedEmail.split('@')[0])}&background=2563eb&color=fff`
            });
            await user.save();
        }

        const jwtToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        setAuthCookie(res, jwtToken);

        res.json({ success: true, token: jwtToken, user });
    } catch (error) {
        console.error('Google mobile login error:', error);
        res.status(500).json({ success: false, error: 'Google mobile login failed' });
    }
};

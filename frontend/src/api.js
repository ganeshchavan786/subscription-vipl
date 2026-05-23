import axios from 'axios';
const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });

export const registerUser      = d => API.post('/register', d);
export const loginUser         = d => API.post('/login', d);
export const getStats          = () => API.get('/stats');

export const getProducts       = (s) => API.get('/products', { params: s ? { search: s } : {} });
export const createProduct     = d => API.post('/products', d);
export const updateProduct     = (id, d) => API.put(`/products/${id}`, d);
export const deleteProduct     = id => API.delete(`/products/${id}`);

export const getCustomers      = (s) => API.get('/customers', { params: s ? { search: s } : {} });
export const createCustomer    = d => API.post('/customers', d);
export const updateCustomer    = (id, d) => API.put(`/customers/${id}`, d);
export const deleteCustomer    = id => API.delete(`/customers/${id}`);

export const getSubscriptions  = (p) => API.get('/subscriptions', { params: p || {} });
export const createSubscription= d => API.post('/subscriptions', d);
export const updateSubscription= (id, d) => API.put(`/subscriptions/${id}`, d);
export const deleteSubscription= id => API.delete(`/subscriptions/${id}`);
export const renewSubscription = id => API.post(`/subscriptions/${id}/renew`);

export default API;

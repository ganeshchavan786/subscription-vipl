import axios from 'axios';
const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(c => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// Auto logout on 401/403
API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

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
export const getCustomerProfile= id => API.get(`/customers/${id}/profile`);
export const getCustomerContacts   = id  => API.get(`/customers/${id}/contacts`);
export const addCustomerContact    = (id,d) => API.post(`/customers/${id}/contacts`, d);
export const updateCustomerContact = (cid,d) => API.put(`/customers/contacts/${cid}`, d);
export const deleteCustomerContact = cid => API.delete(`/customers/contacts/${cid}`);

export const getSubscriptions  = (p) => API.get('/subscriptions', { params: p || {} });
export const createSubscription= d => API.post('/subscriptions', d);
export const updateSubscription= (id, d) => API.put(`/subscriptions/${id}`, d);
export const deleteSubscription= id => API.delete(`/subscriptions/${id}`);
export const renewSubscription = id => API.post(`/subscriptions/${id}/renew`);

export const getRenewalHistory = (p) => API.get('/reports/renewal-history', { params: p || {} });
export const getAtRisk         = ()  => API.get('/reports/at-risk');
export const getFYReport       = ()  => API.get('/reports/fy');
export const getFYExpiryReport = ()  => API.get('/reports/fy-expiry');

export default API;

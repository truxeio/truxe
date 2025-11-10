from django.contrib import admin
from django.urls import path
from django.views.generic import TemplateView
from heimdall_oauth import views as oauth_views
from heimdall_oauth.decorators import require_oauth

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('login/', TemplateView.as_view(template_name='login.html'), name='login'),
    path('oauth/login/', oauth_views.login_view, name='oauth_login'),
    path('oauth/callback/', oauth_views.callback_view, name='oauth_callback'),
    path('oauth/logout/', oauth_views.logout_view, name='oauth_logout'),
    path('dashboard/', require_oauth(TemplateView.as_view(template_name='dashboard.html')), name='dashboard'),
]
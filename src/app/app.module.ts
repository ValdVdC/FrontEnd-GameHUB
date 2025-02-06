import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './componentes/header/header.component';
import { HomeComponent } from './paginas/home/home.component';
import { FooterComponent } from './componentes/footer/footer.component';
import { provideHttpClient } from '@angular/common/http';
import { FormatarNotaPipe } from './pipes/formatar-nota.pipe';
import { DetalhesComponent } from './paginas/detalhes/detalhes.component';
import { FormsModule } from '@angular/forms';
import { SafeVideoUrlPipe } from './pipes/safe-video-url.pipe';


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    HomeComponent,
    FooterComponent,
    FormatarNotaPipe,
    DetalhesComponent,
    SafeVideoUrlPipe,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [
    provideHttpClient()
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

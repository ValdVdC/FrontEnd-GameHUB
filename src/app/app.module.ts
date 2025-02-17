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
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ExploradorComponent } from './paginas/explorador/explorador.component';


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    HomeComponent,
    FooterComponent,
    FormatarNotaPipe,
    DetalhesComponent,
    SafeVideoUrlPipe,
    ExploradorComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    NgbModule
  ],
  providers: [
    provideHttpClient()
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

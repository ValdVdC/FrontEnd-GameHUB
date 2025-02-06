import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './paginas/home/home.component';
import { DetalhesComponent } from './paginas/detalhes/detalhes.component';

const routes: Routes = [
  {
    path: '',component:HomeComponent
  },
  {
    path: 'detalhes/:id',component:DetalhesComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
